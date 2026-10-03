"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Music,
  Mic,
  MessageSquare,
  Image as ImageIcon,
  Share2,
} from "lucide-react";

type OrderRecap = {
  id: string;
  email: string;
  message: string;
  photo_url: string;
  music_option: string;
  music_link: string | null;
  music_file_url: string | null;
  delivery_method: string;
  created_at: string;
  voiceover_url: string | null;
  downloaded_music_url: string | null;
};

export default function RecapPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-dark flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </main>
      }
    >
      <RecapInner />
    </Suspense>
  );
}

function RecapInner() {
  const params = useParams<{ orderId: string }>();
  const search = useSearchParams();
  const orderId = params?.orderId ?? "";
  const token = search.get("t") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderRecap | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  // Web Share API is only useful on mobile (where WeChat shows up in the share
  // sheet). Detect after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    setCanShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!orderId || !token) {
        setError("Lien invalide.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/upload-final/order?orderId=${encodeURIComponent(
            orderId
          )}&t=${encodeURIComponent(token)}`
        );
        const body = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setError(body?.error || "Lien invalide ou expiré.");
        } else {
          setOrder(body.order as OrderRecap);
        }
      } catch {
        if (active) setError("Erreur de chargement.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [orderId, token]);

  const copy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      // clipboard may be blocked — ignore silently
    }
  }, []);

  const shareText = useCallback(async (text: string) => {
    try {
      await navigator.share({ text });
    } catch {
      // user cancelled or unsupported — ignore
    }
  }, []);

  // Generate (or replace) the voiceover MP3 on demand. The automatic pass at
  // payment time skips English-looking messages and can fail silently, so this
  // is the manual escape hatch — it always generates, whatever the language.
  const regenerateVoiceover = useCallback(async () => {
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await fetch("/api/recap/regenerate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.voiceoverUrl) {
        setRegenError(body?.error || "Génération échouée.");
        return;
      }
      // Cache-bust so the <audio> element reloads a replaced MP3 (same key).
      const fresh = `${body.voiceoverUrl}?v=${Date.now()}`;
      setOrder((o) => (o ? { ...o, voiceover_url: fresh } : o));
    } catch {
      setRegenError("Erreur réseau.");
    } finally {
      setRegenerating(false);
    }
  }, [orderId, token]);

  // Open the native share sheet (WeChat appears as a target). Tries to share the
  // actual file first; if file sharing is unsupported (common for audio on iOS)
  // it falls back to sharing the direct link, so WeChat still shows up.
  const shareFile = useCallback(
    async (
      kind: "photo" | "music" | "voiceover",
      proxyUrl: string,
      publicUrl: string,
      base: string
    ) => {
      setSharing(kind);
      try {
        let sharedFile = false;
        try {
          const res = await fetch(proxyUrl);
          if (res.ok) {
            const blob = await res.blob();
            const type = blob.type || "application/octet-stream";
            const ext = type.includes("png")
              ? ".png"
              : type.includes("jpeg") || type.includes("jpg")
                ? ".jpg"
                : type.includes("webp")
                  ? ".webp"
                  : type.startsWith("audio")
                    ? ".mp3"
                    : "";
            const file = new File([blob], `${base}${ext}`, { type });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file] });
              sharedFile = true;
            }
          }
        } catch (e) {
          // User dismissed the share sheet — don't fall back to a link.
          if (e instanceof Error && e.name === "AbortError") return;
        }
        if (!sharedFile) {
          // Fallback: share the direct link (e.g. audio on iOS).
          try {
            await navigator.share({ url: publicUrl });
          } catch {
            window.location.href = proxyUrl;
          }
        }
      } finally {
        setSharing(null);
      }
    },
    []
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-dark flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-dark flex items-center justify-center p-6">
        <div className="glass-card p-8 text-center max-w-sm">
          <AlertTriangle className="text-error mx-auto mb-4" size={40} />
          <p className="text-white font-semibold mb-1">Accès impossible</p>
          <p className="text-white/60 text-sm">{error ?? "Commande introuvable."}</p>
        </div>
      </main>
    );
  }

  const dl = (kind: "photo" | "music" | "voiceover") =>
    `/api/recap/download?orderId=${encodeURIComponent(orderId)}&t=${encodeURIComponent(
      token
    )}&kind=${kind}`;

  // A downloadable music FILE we host (uploaded by the client or auto-downloaded
  // from the link). A bare external music_link can't be force-downloaded.
  const musicFile = order.downloaded_music_url || order.music_file_url || null;

  return (
    <main className="min-h-screen bg-dark text-white px-4 py-6">
      <div className="max-w-md mx-auto space-y-5">
        <header className="flex items-center gap-2 text-primary">
          <MessageSquare size={20} />
          <h1 className="font-bold text-lg">À envoyer au fournisseur</h1>
        </header>

        <p className="text-xs text-white/50">
          Commande {order.id.slice(0, 8)} · {order.email} ·{" "}
          {order.delivery_method === "express" ? "⚡ Express" : "Standard"}
        </p>

        {/* PHOTO */}
        {order.photo_url && (
          <section className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <ImageIcon size={16} /> Photo
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.photo_url}
              alt="Photo client"
              className="w-full rounded-xl object-cover"
            />
            {canShare && (
              <button
                type="button"
                onClick={() => shareFile("photo", dl("photo"), order.photo_url, `commande-${order.id.slice(0, 8)}-photo`)}
                disabled={sharing === "photo"}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2"
              >
                {sharing === "photo" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Share2 size={18} />
                )}
                Partager la photo (WeChat…)
              </button>
            )}
            <a
              href={dl("photo")}
              className="w-full block text-center text-sm text-white/60 underline py-1"
            >
              ou télécharger la photo
            </a>
          </section>
        )}

        {/* MESSAGE */}
        {order.message?.trim() && (
          <section className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <MessageSquare size={16} /> Message client
            </div>
            <p className="text-sm text-white/90 whitespace-pre-wrap break-words rounded-xl bg-white/5 border border-white/10 p-3">
              {order.message}
            </p>
            {canShare && (
              <button
                type="button"
                onClick={() => shareText(order.message)}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2"
              >
                <Share2 size={18} /> Partager le message (WeChat…)
              </button>
            )}
            <button
              type="button"
              onClick={() => copy(order.message, "message")}
              className={`w-full py-3 flex items-center justify-center gap-2 ${
                canShare
                  ? "text-sm text-white/60 underline py-1"
                  : "btn-primary"
              }`}
            >
              {copied === "message" ? (
                <>
                  <Check size={16} /> Copié
                </>
              ) : (
                <>
                  <Copy size={16} /> {canShare ? "ou copier le message" : "Copier le message"}
                </>
              )}
            </button>
          </section>
        )}

        {/* MUSIQUE */}
        <section className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Music size={16} /> Musique
          </div>
          {musicFile ? (
            <>
              {canShare && (
                <button
                  type="button"
                  onClick={() => shareFile("music", dl("music"), musicFile, `commande-${order.id.slice(0, 8)}-musique`)}
                  disabled={sharing === "music"}
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                >
                  {sharing === "music" ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Share2 size={18} />
                  )}
                  Partager la musique (WeChat…)
                </button>
              )}
              <a
                href={dl("music")}
                className="w-full block text-center text-sm text-white/60 underline py-1"
              >
                ou télécharger la musique (MP3)
              </a>
            </>
          ) : order.music_link ? (
            <a
              href={order.music_link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full btn-primary py-3 flex items-center justify-center gap-2 break-all"
            >
              <Download size={18} /> Ouvrir le lien musique
            </a>
          ) : order.music_option === "custom" ? (
            <p className="text-sm text-white/50">
              Musique personnalisée demandée, mais aucun lien/fichier fourni.
            </p>
          ) : (
            <p className="text-sm text-white/50">
              Pas de musique fournie (au choix).
            </p>
          )}
        </section>

        {/* VOCAL — always rendered, so a missing voiceover is visible and
            fixable here instead of the whole section silently disappearing. */}
        <section className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Mic size={16} /> Vocal (lecture du message)
          </div>

          {order.voiceover_url ? (
            <>
              <audio src={order.voiceover_url} controls className="w-full" />
              {canShare && (
                <button
                  type="button"
                  onClick={() => shareFile("voiceover", dl("voiceover"), order.voiceover_url!, `commande-${order.id.slice(0, 8)}-vocal`)}
                  disabled={sharing === "voiceover"}
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                >
                  {sharing === "voiceover" ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Share2 size={18} />
                  )}
                  Partager le vocal (WeChat…)
                </button>
              )}
              <a
                href={dl("voiceover")}
                className="w-full block text-center text-sm text-white/60 underline py-1"
              >
                ou télécharger le vocal (MP3)
              </a>
            </>
          ) : (
            <p className="text-sm text-white/50">
              Aucun vocal pour cette commande.
            </p>
          )}

          <button
            type="button"
            onClick={regenerateVoiceover}
            disabled={regenerating || !order.message?.trim()}
            className={
              order.voiceover_url
                ? "w-full text-center text-sm text-white/60 underline py-1 disabled:opacity-50"
                : "w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            }
          >
            {regenerating ? (
              <Loader2 size={18} className="animate-spin inline" />
            ) : order.voiceover_url ? (
              "Régénérer le vocal"
            ) : (
              <>
                <Mic size={18} /> Générer le vocal
              </>
            )}
          </button>

          {regenError && (
            <p className="text-sm text-error text-center">{regenError}</p>
          )}
        </section>

        <p className="text-center text-xs text-white/40 pt-2">
          {canShare
            ? "Tape « Partager » → choisis WeChat → choisis ton fournisseur."
            : "Ouvre cette page sur ton téléphone pour partager directement dans WeChat."}
        </p>
      </div>
    </main>
  );
}
