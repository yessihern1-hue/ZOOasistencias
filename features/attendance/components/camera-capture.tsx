"use client";

import { useEffect, useRef, useState } from "react";

export function CameraCapture({
  onCapture,
}: {
  onCapture: (photo: string) => void;
}) {

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");


  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este dispositivo no permite acceder a la cámara.");
      return;
    }

    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setError("No se pudo abrir la cámara. Revisa el permiso del navegador.");
    } finally {
      setIsStarting(false);
    }
  }


  function takePhoto(){

    const video = videoRef.current;

    if(!video) return;


    const canvas = document.createElement("canvas");

    if (!video.videoWidth || !video.videoHeight) {
      setError("La cámara todavía no está lista. Intenta nuevamente.");
      return;
    }

    const maximumDimension = 1280;
    const scale = Math.min(1, maximumDimension / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);


    const ctx = canvas.getContext("2d");

    ctx?.drawImage(video,0,0);


    const image = canvas.toDataURL("image/webp", 0.82);

    onCapture(image);

    streamRef.current?.getTracks().forEach(track => track.stop());

    setCameraActive(false);
  }

  useEffect(() => {
  return () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  };
  }, []);

  return (
    <div className="camera-box camera-center">

      {!cameraActive && (
        <button
          className="button button-secondary"
          disabled={isStarting}
          onClick={startCamera}
          type="button"
        >
          {isStarting ? "Abriendo cámara…" : "Activar cámara"}
        </button>
      )}


      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="camera-preview"
      />


      {
        cameraActive &&
        <button
          className="button button-primary"
          onClick={takePhoto}
          type="button"
        >
          Tomar fotografía
        </button>
      }

      {error && <p className="camera-error" role="alert">{error}</p>}


    </div>
  );
}
