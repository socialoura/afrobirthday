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
            <a
              href={dl("photo")}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
            >
              <Download size={18} /> Télécharger la photo
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
            <button
              type="button"
              onClick={() => copy(order.message, "message")}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
            >
              {copied === "message" ? (
                <>
                  <Check size={18} /> Copié
                </>
              ) : (
                <>
                  <Copy size={18} /> Copier le message
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
            <a
              href={dl("music")}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
            >
              <Download size={18} /> Télécharger la musique (MP3)
            </a>
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

        {/* VOCAL */}
        {order.voiceover_url && (
          <section className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <Mic size={16} /> Vocal (lecture du message)
            </div>
            <audio src={order.voiceover_url} controls className="w-full" />
            <a
              href={dl("voiceover")}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
            >
              <Download size={18} /> Télécharger le vocal (MP3)
            </a>
          </section>
        )}

        <p className="text-center text-xs text-white/40 pt-2">
          Astuce : ouvre chaque fichier puis partage-le dans WeChat, et colle le
          message copié.
        </p>
      </div>
    </main>
  );
}
