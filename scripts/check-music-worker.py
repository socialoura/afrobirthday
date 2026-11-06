#!/usr/bin/env python3
"""Offline worker checks. Never contact storage, Telegram or a production DB."""
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

spec = importlib.util.spec_from_file_location('worker', Path(__file__).with_name('music-worker.py'))
assert spec is not None and spec.loader is not None
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)
SECRET = 'test-only-not-a-real-secret-123456789'
JOB = {'jobId': '22222222-2222-4222-8222-222222222222', 'orderId': '11111111-1111-4111-8111-111111111111', 'musicLink': 'https://open.spotify.com/track/4Fb44L52QsQtHT0mL9WhtE', 'createdAt': int(time.time()*1000)}


def envelope(job):
    nonce = os.urandom(12)
    encrypted = AESGCM(hashlib.sha256(('afrobirthday-music-jobs\n'+SECRET).encode()).digest()).encrypt(nonce, json.dumps(job).encode(), None)
    return json.dumps({'v':1,'nonce':base64.b64encode(nonce).decode(),'ciphertext':base64.b64encode(encrypted[:-16]).decode(),'tag':base64.b64encode(encrypted[-16:]).decode()}).encode()


class WorkerTests(unittest.TestCase):
    def test_encrypted_jobs_and_tampering(self):
        raw=envelope(JOB)
        self.assertEqual(w.decrypt_job(raw,SECRET),JOB)
        with self.assertRaises(Exception): w.decrypt_job(raw,SECRET+'wrong')
        with self.assertRaises(Exception): w.decrypt_job(envelope({**JOB,'orderId':'../outside'}),SECRET)
        with self.assertRaises(Exception): w.decrypt_job(envelope({**JOB,'createdAt':0}),SECRET)
        with self.assertRaises(Exception): w.decrypt_job(envelope({**JOB,'musicLink':'https://127.0.0.1/'}),SECRET)

    def test_allowlist(self):
        for url in ['http://localhost/x','https://youtube.com.attacker.invalid/x','https://user:password@youtube.com/x','https://open.spotify.com:777/x','https://bandcamp.com.evil.invalid/track/x']:
            self.assertFalse(w.allowed_url(url))
        self.assertTrue(w.allowed_url('https://biasselector.bandcamp.com/track/fdic'))

    def test_bandcamp_exact_metadata_only(self):
        class Response:
            def raise_for_status(self): pass
            def json(self): return {'auto':{'results':[
                {'type':'t','name':'FDIC','band_name':'Bias Selector','item_url_path':'https://biasselector.bandcamp.com/track/fdic'},
                {'type':'t','name':'FDIC Live','band_name':'Bias Selector','item_url_path':'https://biasselector.bandcamp.com/track/live'},
                {'type':'t','name':'FDIC','band_name':'Another artist','item_url_path':'https://other.bandcamp.com/track/fdic'},
                {'type':'t','name':'FDIC','band_name':'Bias Selector','item_url_path':'https://127.0.0.1/secret'},
            ]}}
        with patch.object(w.requests,'post',return_value=Response()):
            self.assertEqual(w.bandcamp_candidates({'title':'FDIC','artists':['Bias Selector']}),['https://biasselector.bandcamp.com/track/fdic'])

    def test_reject_previews_and_wrong_audio(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as folder:
            path=Path(folder)/'music.mp3';path.write_bytes(b'0'*2048)
            with patch.object(w,'command',return_value=json.dumps({'format':{'duration':'30'},'streams':[{'codec_name':'mp3'}]})):
                with self.assertRaises(ValueError):w.validate_mp3(path,168)
            with patch.object(w,'command',return_value=json.dumps({'format':{'duration':'168'},'streams':[{'codec_name':'aac'}]})):
                with self.assertRaises(ValueError):w.validate_mp3(path,168)

    def test_download_then_retry_delivery_without_redownload(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as folder:
            root=Path(folder);state=root/'state';state.mkdir();path=root/(JOB['jobId']+'.json');path.write_bytes(envelope(JOB))
            def download(_,audio):audio.write_bytes(b'example-audio-test');return {'duration':168}
            with patch.object(w,'download_music',side_effect=download) as downloader,patch.object(w,'deliver',side_effect=ValueError):
                w.process_job(path,SECRET,root/'media',state,root/'scratch')
                self.assertEqual(downloader.call_count,1)
                status=json.loads((state/path.name).read_text());self.assertEqual(status['result'],'ready');self.assertFalse(status.get('done',False));status['nextAttempt']=0;(state/path.name).write_text(json.dumps(status))
            with patch.object(w,'download_music',side_effect=AssertionError('should not redownload')),patch.object(w,'deliver',return_value={'ok':True,'messageId':42}):
                w.process_job(path,SECRET,root/'media',state,root/'scratch')
            self.assertFalse(path.exists());self.assertEqual(json.loads((state/path.name).read_text())['receipt']['messageId'],42)
            self.assertFalse(any((root/'scratch').iterdir()))

    def test_download_failure_requires_confirmed_alert(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as folder:
            root=Path(folder);state=root/'state';state.mkdir();path=root/(JOB['jobId']+'.json');path.write_bytes(envelope(JOB))
            with patch.object(w,'download_music',side_effect=ValueError),patch.object(w,'deliver',return_value={'ok':True,'alerted':True}) as send:
                w.process_job(path,SECRET,root/'media',state,root/'scratch')
                self.assertEqual(send.call_args.args[1],'failed')
                self.assertTrue(json.loads((state/path.name).read_text())['done'])

    def test_quarantine_untrusted_jobs(self):
        with tempfile.TemporaryDirectory(dir=os.environ['TMPDIR']) as folder:
            root=Path(folder);state=root/'state';state.mkdir();path=root/(JOB['jobId']+'.json');path.write_text('{}')
            with patch.object(w,'download_music',side_effect=AssertionError('untrusted input')):
                w.process_job(path,SECRET,root/'media',state,root/'scratch')
            self.assertFalse(path.exists());self.assertTrue((state/(JOB['jobId']+'.rejected')).exists())


if __name__=='__main__':unittest.main()
