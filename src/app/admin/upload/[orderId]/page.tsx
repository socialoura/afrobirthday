"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { uploadFileWithProgress } from "@/lib/clientUpload";
import {
  Upload,
  Loader2,
  CheckCircle2,
  Send,
  AlertTriangle,
  Film,
} from "lucide-react";

type OrderSummary = {
  id: string;
  email: string;
  message: string;
  photo_url: string;
  music_option: string;
  music_link: string | null;
  music_file_url: string | null;
  delivery_method: string;
  created_at: string;
  final_video_url: string | null;
  final_video_sent_at: string | null;
};

export default function MobileUploadPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-dark flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </main>
      }
    >
      <MobileUploadInner />
    </Suspense>
  );
}

function MobileUploadInner() {
  const params = useParams<{ orderId: string }>();
  const search = useSearchParams();
  const orderId = params?.orderId ?? "";
  const token = search.get("t") ?? "";

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

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
          setOrder(body.order as OrderSummary);
          setVideoUrl(body.order?.final_video_url ?? null);
          setSentAt(body.order?.final_video_sent_at ?? null);
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

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setProgress(0);
      setActionMsg(null);
      try {
        const videoUrl = await uploadFileWithProgress(orderId, file, token, (pct) =>
          setProgress(pct)
        );

        const res = await fetch("/api/upload-final/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, t: token, videoUrl }),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b?.error || "Échec de l'enregistrement");
        }

        setVideoUrl(videoUrl);
        setActionMsg("Vidéo uploadée ✓");
      } catch (err) {
        setActionMsg(
          err instanceof Error ? err.message : "Échec de l'upload"
        );
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [orderId, token]
  );

  const sendToCustomer = useCallback(async () => {
    if (!videoUrl) return;
    setSending(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/upload-final/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, t: token, videoUrl, sendEmail: true }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b?.error || "Échec de l'envoi");
      setSentAt(new Date().toISOString());
      setActionMsg("Email envoyé au client ✓");
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  }, [orderId, token, videoUrl]);

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

  return (
    <main className="min-h-screen bg-dark text-white px-4 py-6">
      <div className="max-w-md mx-auto space-y-5">
        <header className="flex items-center gap-2 text-primary">
          <Film size={20} />
          <h1 className="font-bold text-lg">Vidéo finale</h1>
        </header>

        {/* Order summary — confirm it's the right order */}
        <section className="glass-card p-4">
          <div className="flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={order.photo_url}
              alt="Photo client"
              className="w-20 h-20 rounded-xl object-cover shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/50">Commande {order.id.slice(0, 8)}</p>
              <p className="text-sm text-white/90 truncate">{order.email}</p>
              <p className="text-xs text-white/60 mt-1">
                {order.delivery_method === "express" ? "⚡ Express" : "Standard"}
                {" · "}
                {order.music_option === "custom" ? "🎶 Musique perso" : "🎵 Au choix"}
              </p>
            </div>
          </div>
          {order.message && (
            <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3">
              <p className="text-[11px] uppercase tracking-wide text-white/40 mb-1">
                Message
              </p>
              <p className="text-sm text-white/90 whitespace-pre-wrap break-words">
                {order.message}
              </p>
            </div>
          )}
          {order.music_option === "custom" && (order.music_link || order.music_file_url) && (
            <a
              href={order.music_link || order.music_file_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-primary underline break-all"
            >
              🎵 {order.music_link || "Fichier musique"}
            </a>
          )}
        </section>

        {/* Upload control */}
        <section className="glass-card p-5">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full btn-primary py-5 text-base flex items-center justify-center gap-2 min-h-[64px]"
          >
            {uploading ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                Envoi… {progress}%
              </>
            ) : (
              <>
                <Upload size={22} />
                {videoUrl ? "Remplacer la vidéo" : "Choisir / filmer la vidéo"}
              </>
            )}
          </button>

          {uploading && (
            <div className="mt-4 h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {videoUrl && !uploading && (
            <div className="mt-4 flex items-center gap-2 text-success text-sm">
              <CheckCircle2 size={18} />
              <span>Vidéo prête</span>
            </div>
          )}
        </section>

        {/* Deliver to customer */}
        {videoUrl && (
          <section className="glass-card p-5 space-y-3">
            <button
              type="button"
              onClick={sendToCustomer}
              disabled={sending}
              className="w-full btn-primary py-4 flex items-center justify-center gap-2 min-h-[56px]"
            >
              {sending ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Envoi de l&apos;email…
                </>
              ) : (
                <>
                  <Send size={18} />
                  {sentAt ? "Renvoyer au client" : "Envoyer au client"}
                </>
              )}
            </button>
            {sentAt && (
              <p className="text-center text-xs text-white/50">
                Envoyé le {new Date(sentAt).toLocaleString("fr-FR")}
              </p>
            )}
          </section>
        )}

        {actionMsg && (
          <p className="text-center text-sm text-white/80">{actionMsg}</p>
        )}
      </div>
    </main>
  );
}
