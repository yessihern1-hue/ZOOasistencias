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


  async function startCamera() {

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
      },
    });

    streamRef.current = stream;

    if(videoRef.current){
      videoRef.current.srcObject = stream;
    }

    setCameraActive(true);
  }


  function takePhoto(){

    const video = videoRef.current;

    if(!video) return;


    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;


    const ctx = canvas.getContext("2d");

    ctx?.drawImage(video,0,0);


    const image = canvas.toDataURL("image/png");

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
          onClick={startCamera}
        >
          Activar cámara
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
        >
          Tomar fotografía
        </button>
      }


    </div>
  );
}