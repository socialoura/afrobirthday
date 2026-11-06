#!/usr/bin/env python3
"""Single-worker encrypted file queue. No paid API, port, root or production DB access."""
import argparse
import base64
import fcntl
import hashlib
import hmac
import html
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unicodedata
import uuid
from urllib.parse import urlparse
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from curl_cffi import requests

MAX_BYTES = 30 * 1024 * 1024
STOP = False
CALLBACK = 'https://www.afrobirthday.com/api/internal/music-result'


def normalize(value):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower())


def allowed_url(value):
    try:
        p = urlparse(value)
        host = (p.hostname or '').removeprefix('www.').removeprefix('m.')
        return len(value) <= 2048 and p.scheme == 'https' and not p.username and not p.password and p.port in (None, 443) and (host in ('youtube.com', 'music.youtube.com', 'youtu.be', 'open.spotify.com', 'spotify.com', 'spotify.link', 'soundcloud.com', 'on.soundcloud.com') or re.fullmatch(r'[a-z0-9-]+\.bandcamp\.com', host))
    except ValueError:
        return False


def load_secret():
    # Read only the vault machine credential, not the business/database env.
    if not os.environ.get('BWS_ACCESS_TOKEN') and os.environ.get('MUSIC_VAULT_ENV'):
        from dotenv import dotenv_values
        token = dotenv_values(os.environ['MUSIC_VAULT_ENV']).get('BWS_ACCESS_TOKEN')
        if token:
            os.environ['BWS_ACCESS_TOKEN'] = token
    reference = os.environ['MUSIC_SECRET_ID']
    result = subprocess.run(['bws', 'secret', 'get', reference], capture_output=True, text=True, timeout=30, check=True)
    item = json.loads(result.stdout)
    if item.get('key') != 'ADMIN_TOKEN_SECRET_AFROBIRTHDAY' or len(item.get('value', '')) < 32:
        raise ValueError('Incorrect worker secret')
    return item['value']


def decrypt_job(raw, secret):
    if len(raw) > 16_384:
        raise ValueError('Oversized job')
    envelope = json.loads(raw)
    if envelope.get('v') != 1:
        raise ValueError('Invalid envelope version')
    key = hashlib.sha256(('afrobirthday-music-jobs\n' + secret).encode()).digest()
    plain = AESGCM(key).decrypt(base64.b64decode(envelope['nonce'], validate=True), base64.b64decode(envelope['ciphertext'], validate=True) + base64.b64decode(envelope['tag'], validate=True), None)
    job = json.loads(plain)
    for key in ('jobId', 'orderId'):
        if str(uuid.UUID(job[key])) != job[key].lower():
            raise ValueError('Invalid UUID')
    if not allowed_url(job['musicLink']) or not 0 <= time.time() * 1000 - job['createdAt'] <= 7 * 86400_000:
        raise ValueError('Invalid or expired job')
    return job


def command(args, timeout=45):
    # Deliberately capture stderr: yt-dlp can print temporary signed CDN URLs.
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise ValueError('Audio provider refused request')
    return result.stdout


def spotify_metadata(link):
    match = re.search(r'/track/([A-Za-z0-9]{22})(?:[/?#]|$)', link)
    if not match:
        # Follow only Spotify-owned redirects, never a generic arbitrary URL.
        for _ in range(4):
            r = requests.get(link, allow_redirects=False, impersonate='chrome', timeout=10)
            target = r.headers.get('location', '')
            if not target or not allowed_url(target) or urlparse(target).hostname not in ('open.spotify.com', 'spotify.com', 'spotify.link'):
                raise ValueError('No Spotify track')
            link = target
            match = re.search(r'/track/([A-Za-z0-9]{22})(?:[/?#]|$)', link)
            if match:
                break
    if not match:
        raise ValueError('No Spotify track')
    response = requests.get('https://open.spotify.com/embed/track/' + match[1], impersonate='chrome', timeout=12)
    response.raise_for_status()
    script = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', response.text, re.S)
    if not script:
        raise ValueError('Spotify metadata unavailable')
    entity = json.loads(script[1])['props']['pageProps']['state']['data']['entity']
    artists = [a['name'] for a in entity.get('artists', []) if a.get('name')]
    title = entity.get('name') or entity.get('title')
    duration = entity.get('duration', 0) / 1000
    if not artists or not title or not 5 <= duration <= 900:
        raise ValueError('Incomplete Spotify metadata')
    return {'title': title, 'artists': artists, 'duration': duration}


def bandcamp_candidates(meta):
    response = requests.post('https://bandcamp.com/api/bcsearch_public_api/1/autocomplete_elastic', json={'search_text': meta['title'] + ' ' + ' '.join(meta['artists']), 'search_filter': 't', 'full_page': False}, impersonate='chrome', timeout=12)
    response.raise_for_status()
    matches = []
    for item in response.json().get('auto', {}).get('results', []):
        artist = re.sub(r'^by\s+', '', html.unescape(item.get('band_name') or ''), flags=re.I)
        title = html.unescape(item.get('name') or '')
        link = item.get('item_url_path') or ''
        if item.get('type') == 't' and normalize(title) == normalize(meta['title']) and len(meta['artists']) == 1 and normalize(artist) == normalize(meta['artists'][0]) and allowed_url(link) and re.fullmatch(r'[a-z0-9-]+\.bandcamp\.com', urlparse(link).hostname or ''):
            matches.append(link)
    return matches[:2]


def youtube_candidates(meta):
    query = 'ytsearch3:' + meta['title'] + ' ' + ' '.join(meta['artists']) + ' official audio'
    raw = command([sys.executable, '-m', 'yt_dlp', '--no-cache-dir', '--flat-playlist', '--socket-timeout', '8', '--retries', '0', '--dump-single-json', '--skip-download', query], timeout=35)
    links = []
    for item in json.loads(raw).get('entries', []):
        title = normalize(item.get('title') or '')
        for suffix in ('officialmusicvideo', 'officialvideo', 'officialaudio', 'lyricvideo', 'lyrics', 'audio'):
            if title.endswith(suffix):
                title = title[:-len(suffix)]
        artist = normalize(''.join(meta['artists']))
        expected = normalize(meta['title'])
        uploader = normalize(re.sub(r'\s*-\s*Topic$', '', item.get('channel') or item.get('uploader') or '', flags=re.I))
        duration = item.get('duration') or 0
        if (title in (expected + artist, artist + expected) or (title == expected and uploader == artist)) and abs(duration - meta['duration']) <= 3:
            video_id = item.get('id', '')
            if re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id):
                links.append('https://www.youtube.com/watch?v=' + video_id)
    return links[:2]


def validate_mp3(path, expected_duration=None):
    if not path.is_file() or not 1024 <= path.stat().st_size <= MAX_BYTES:
        raise ValueError('Invalid audio size')
    probe = json.loads(command(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_name', '-of', 'json', str(path)], timeout=10))
    duration = float(probe['format']['duration'])
    if not 5 <= duration <= 900 or not probe.get('streams') or probe['streams'][0]['codec_name'] != 'mp3':
        raise ValueError('Invalid MP3')
    if expected_duration and abs(expected_duration - duration) > 3:
        raise ValueError('Incomplete audio or different version')
    command(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(path), '-f', 'null', '-'], timeout=30)
    return duration


def download_one(link, destination, expected_duration=None):
    args = [sys.executable, '-m', 'yt_dlp', '--no-cache-dir', '--no-playlist', '--socket-timeout', '10', '--retries', '0', '--fragment-retries', '0', '--max-filesize', str(MAX_BYTES), '--match-filter', 'duration >= 5 & duration <= 900', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0', '-o', str(destination.with_suffix('.%(ext)s')), link]
    command(args, timeout=100)
    return validate_mp3(destination, expected_duration)


def download_music(link, destination):
    if not allowed_url(link):
        raise ValueError('Unsupported music source')
    if 'spotify' not in (urlparse(link).hostname or ''):
        return {'duration': download_one(link, destination)}
    meta = spotify_metadata(link)
    # First use the artist's freely playable full track, never a paid download.
    # Require exact artist/title, then verify actual decoded duration.
    try:
        candidates = bandcamp_candidates(meta)
    except Exception:
        candidates = []
    for source in candidates:
        try:
            return {**meta, 'duration': download_one(source, destination, meta['duration']), 'source': 'bandcamp'}
        except (ValueError, subprocess.TimeoutExpired):
            destination.unlink(missing_ok=True)
    for source in youtube_candidates(meta):
        try:
            return {**meta, 'duration': download_one(source, destination, meta['duration']), 'source': 'youtube'}
        except (ValueError, subprocess.TimeoutExpired):
            destination.unlink(missing_ok=True)
    raise ValueError('No accessible complete matching track')


def deliver(job, outcome, secret):
    body = json.dumps({**job, 'result': outcome}, separators=(',', ':')).encode()
    timestamp = str(int(time.time() * 1000))
    signature = hmac.new(secret.encode(), b'afrobirthday-music-result\n' + timestamp.encode() + b'\n' + body, hashlib.sha256).hexdigest()
    response = requests.post(CALLBACK, data=body, headers={'content-type': 'application/json', 'x-music-timestamp': timestamp, 'x-music-signature': signature}, timeout=45)
    if response.status_code == 409:
        return {'ok': True, 'ignored': 'order-or-source-changed'}
    response.raise_for_status()
    receipt = response.json()
    if receipt.get('ok') is not True:
        raise ValueError('Delivery not confirmed')
    return receipt


def write_state(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data))
    temporary.replace(path)


def process_job(path, secret, media_root, state_root, scratch_root):
    state_path = state_root / path.name
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    if state.get('done'):
        path.unlink(missing_ok=True)
        return
    if state.get('nextAttempt', 0) > time.time():
        return
    try:
        job = decrypt_job(path.read_bytes(), secret)
        if path.stem != job['jobId']:
            raise ValueError('Filename mismatch')
    except Exception:
        # Quarantine malformed jobs; never interpret attacker-controlled commands.
        path.replace(state_root / (path.stem + '.rejected'))
        print(json.dumps({'jobId': path.stem, 'rejected': True}), flush=True)
        return
    if not state.get('result'):
        scratch_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='job-', dir=scratch_root) as temporary:
            try:
                audio = Path(temporary) / 'music.mp3'
                metadata = download_music(job['musicLink'], audio)
                output = media_root / 'orders/music' / (job['orderId'] + '-' + job['jobId'] + '.mp3')
                output.parent.mkdir(parents=True, exist_ok=True)
                staging = output.with_suffix('.part')
                shutil.copyfile(audio, staging)
                staging.chmod(0o644)
                staging.replace(output)
                state.update(result='ready', metadata=metadata)
            except Exception:
                state.update(result='failed')
        write_state(state_path, state)
    try:
        receipt = deliver(job, state['result'], secret)
        state.update(done=True, receipt=receipt, finishedAt=int(time.time()))
        write_state(state_path, state)
        path.unlink()
        print(json.dumps({'jobId': job['jobId'], 'outcome': state['result'], 'receipt': receipt}), flush=True)
    except Exception:
        attempts = state.get('attempts', 0) + 1
        state.update(attempts=attempts, nextAttempt=time.time() + min(1800, 30 * 2 ** min(attempts, 6)))
        write_state(state_path, state)
        print(json.dumps({'jobId': job['jobId'], 'callbackPending': True, 'attempts': attempts}), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    media_root = Path(os.environ.get('MUSIC_MEDIA_ROOT', '/srv/media/afrobirthday'))
    state_root = Path(os.environ.get('MUSIC_STATE_ROOT', str(Path.home() / '.local/state/afrobirthday-music')))
    scratch_root = Path(os.environ['MUSIC_SCRATCH_ROOT'])
    scratch_root.mkdir(parents=True, exist_ok=True)
    state_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    queue = media_root / 'orders/music-jobs'
    queue.mkdir(parents=True, exist_ok=True)
    lock = (state_root / 'worker.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    secret = load_secret()
    def stop(*_):
        global STOP
        STOP = True
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    print('AfroBirthday music worker ready', flush=True)
    while not STOP:
        for path in sorted(queue.glob('*.json'), key=lambda p: p.stat().st_mtime):
            if STOP:
                break
            process_job(path, secret, media_root, state_root, scratch_root)
        if args.once:
            break
        time.sleep(3)
    if scratch_root.exists() and not any(scratch_root.iterdir()):
        scratch_root.rmdir()


if __name__ == '__main__':
    main()
