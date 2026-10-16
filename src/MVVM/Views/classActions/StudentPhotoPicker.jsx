import { useCallback, useEffect, useRef, useState } from "react";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-1.5 rounded border border-accent/40 bg-transparent px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 rounded bg-accent px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-canvas transition hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

function resizeImage(fileOrUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 512 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => reject(new Error("The photo could not be loaded."));
    image.src = typeof fileOrUrl === "string" ? fileOrUrl : URL.createObjectURL(fileOrUrl);
  });
}

const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function StudentPhotoPicker({ value = "", onChange, disabled = false }) {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
  }, [cameraOpen]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Photos must be 2 MB or smaller.");
      return;
    }
    try {
      setError("");
      onChange?.(await resizeImage(file));
    } catch (failure) {
      setError(failure.message || "The photo could not be read.");
    }
  };

  const openCamera = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is unavailable. Use HTTPS or localhost, or choose a photo.");
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setCameraOpen(true);
    } catch (failure) {
      setError(
        failure.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser, then try again."
          : "The camera could not be opened. Use the photo picker instead.",
      );
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setError("The camera is still starting. Try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    onChange?.(canvas.toDataURL("image/jpeg", 0.82));
    stopCamera();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Preview */}
      <div
        className={`relative grid size-28 place-items-center overflow-hidden rounded-xl ${
          value
            ? "border border-accent/40 shadow-glow"
            : "border border-dashed border-ink-3/50 bg-surface-1"
        }`}
      >
        {value ? (
          <img
            src={value}
            alt="Student preview"
            className="size-full object-cover"
          />
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="44"
            height="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink-3"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" />
          </svg>
        )}
      </div>

      {/* Actions */}
      <div className="flex w-full flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className={BTN_OUTLINE}
        >
          <svg {...iconProps} aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          {value ? "Replace" : "Upload"}
        </button>
        <button
          type="button"
          onClick={openCamera}
          disabled={disabled || cameraOpen}
          className={BTN_PRIMARY}
        >
          <svg {...iconProps} aria-hidden="true">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Selfie
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={disabled}
          className="hidden"
        />
      </div>

      {value ? (
        <button
          type="button"
          onClick={() => onChange?.("")}
          disabled={disabled}
          className="text-[11px] font-medium text-ink-3 transition hover:text-rose-400 disabled:opacity-50"
        >
          Remove photo
        </button>
      ) : (
        <p className="text-center text-[11px] text-ink-3">
          JPG or PNG, up to 2 MB
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="w-full rounded border border-rose-400/30 bg-rose-500/10 p-2.5 text-center text-[11px] font-medium text-rose-300"
        >
          {error}
        </p>
      )}

      {cameraOpen && (
        <div
          role="dialog"
          aria-label="Take student selfie"
          className="w-full rounded-xl border border-accent/30 bg-surface-1 p-3.5 shadow-modal"
        >
          <div className="mb-2.5 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
            <span className="size-1.5 animate-pulse rounded-full bg-rose-500" />
            Camera preview
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="block aspect-[4/3] w-full -scale-x-100 rounded-lg bg-canvas object-cover"
          />
          <div className="mt-3 flex justify-center gap-2">
            <button type="button" onClick={capturePhoto} className={BTN_PRIMARY}>
              Capture photo
            </button>
            <button type="button" onClick={stopCamera} className={BTN_OUTLINE}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
