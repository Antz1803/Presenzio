import { useCallback, useEffect, useRef, useState } from "react";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const buttonStyle = {
  border: "1px solid #c7d2fe",
  borderRadius: 10,
  padding: "8px 13px",
  background: "#ffffff",
  color: "#4338ca",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
const primaryButtonStyle = {
  ...buttonStyle,
  borderColor: "#6366f1",
  background: "#4f46e5",
  color: "#ffffff",
};

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
    <div className="student-photo-picker">
      {value ? (
        <img
          src={value}
          alt="Student preview"
          style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12 }}
        />
      ) : (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#e0e7ff",
            color: "#4f46e5",
            fontWeight: 700,
          }}
        >
          ?
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          style={buttonStyle}
        >
          Choose photo
        </button>
        <button
          type="button"
          onClick={openCamera}
          disabled={disabled || cameraOpen}
          style={primaryButtonStyle}
        >
          Take selfie
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={disabled}
          style={{ display: "none" }}
        />
      </div>
      {error && <p className="action-error">{error}</p>}
      {cameraOpen && (
        <div
          role="dialog"
          aria-label="Take student selfie"
          style={{
            marginTop: 14,
            padding: 14,
            width: "min(100%, 548px)",
            maxWidth: "100%",
            boxSizing: "border-box",
            borderRadius: 16,
            background: "linear-gradient(145deg, #111827, #1e1b4b)",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
          }}
        >
          <div style={{ color: "#e0e7ff", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
            Camera preview
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              display: "block",
              width: "100%",
              maxWidth: "none",
              aspectRatio: "4 / 3",
              objectFit: "cover",
              borderRadius: 12,
              background: "#020617",
              transform: "scaleX(-1)",
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" onClick={capturePhoto} style={primaryButtonStyle}>
              Capture photo
            </button>
            <button
              type="button"
              onClick={stopCamera}
              style={{ ...buttonStyle, color: "#e0e7ff", background: "transparent", borderColor: "#818cf8" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
