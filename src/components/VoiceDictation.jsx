import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function appendDictationText(baseText = "", dictatedText = "") {
  const cleanDictation = dictatedText.trim();
  if (!cleanDictation) return baseText;
  const cleanBase = String(baseText ?? "").trimEnd();
  if (!cleanBase) return cleanDictation;
  return `${cleanBase}${/\s$/.test(baseText) ? "" : " "}${cleanDictation}`;
}

function DictationButton({ disabled = false, onBusyChange, onChange, onNotice, value = "" }) {
  const recognitionRef = useRef(null);
  const busyRef = useRef(false);
  const errorRef = useRef("");
  const baseValueRef = useRef("");
  const finalTextRef = useRef("");
  const [phase, setPhase] = useState("idle");
  const isBusy = phase === "listening" || phase === "finalizing";

  function setBusy(nextBusy) {
    if (busyRef.current === nextBusy) return;
    busyRef.current = nextBusy;
    onBusyChange?.(nextBusy);
  }

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch (_error) {
        // Browser-specific abort errors during unmount are harmless.
      }
      setBusy(false);
    };
  }, []);

  function finish(message = "Dictation text ready.") {
    recognitionRef.current = null;
    setPhase("idle");
    setBusy(false);
    if (errorRef.current) {
      onNotice?.(errorRef.current);
      errorRef.current = "";
      return;
    }
    onNotice?.(message);
  }

  function start(event) {
    event.preventDefault();
    event.stopPropagation();
    if ("pointerId" in event) event.currentTarget.setPointerCapture?.(event.pointerId);
    if (disabled || busyRef.current) return;

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      onNotice?.("Voice dictation is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    baseValueRef.current = value ?? "";
    finalTextRef.current = "";
    errorRef.current = "";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (resultEvent) => {
      let finalText = "";
      let interimText = "";
      for (let index = resultEvent.resultIndex; index < resultEvent.results.length; index += 1) {
        const transcript = resultEvent.results[index]?.[0]?.transcript ?? "";
        if (resultEvent.results[index].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText.trim()) finalTextRef.current = `${finalTextRef.current} ${finalText}`.trim();
      const visibleText = `${finalTextRef.current} ${interimText}`.trim();
      if (visibleText) onChange?.(appendDictationText(baseValueRef.current, visibleText));
    };

    recognition.onerror = (errorEvent) => {
      errorRef.current =
        errorEvent.error === "not-allowed"
          ? "Microphone permission is blocked for this browser."
          : errorEvent.error === "no-speech"
            ? "No speech detected."
            : "Voice dictation stopped.";
    };

    recognition.onend = () => finish();

    try {
      setPhase("listening");
      setBusy(true);
      onNotice?.("Listening... release the mic to finish.");
      recognition.start();
    } catch (error) {
      errorRef.current = error.message || "Voice dictation could not start.";
      finish();
    }
  }

  function stop(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!busyRef.current) return;
    setPhase("finalizing");
    onNotice?.("Finalizing dictation...");
    try {
      recognitionRef.current?.stop();
    } catch (_error) {
      finish();
    }
  }

  return (
    <button
      className={`dictateButton ${isBusy ? "active" : ""} ${phase === "finalizing" ? "finalizing" : ""}`}
      type="button"
      aria-label={isBusy ? "Finish dictation" : "Tap and hold to dictate"}
      title={isBusy ? "Release to finish dictation" : "Tap and hold to dictate"}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") start(event);
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") stop(event);
      }}
      onPointerCancel={stop}
      onPointerDown={start}
      onPointerUp={stop}
    >
      <Mic size={17} />
      <span>{phase === "finalizing" ? "Finalizing" : isBusy ? "Listening" : "Hold to dictate"}</span>
    </button>
  );
}

export function VoiceTextArea({ dictation, onChange, value, ...props }) {
  return (
    <div className="voiceTextControl">
      <textarea {...props} value={value} onChange={(event) => onChange?.(event.target.value)} />
      <DictationButton
        disabled={dictation?.disabled}
        onBusyChange={dictation?.onBusyChange}
        onChange={onChange}
        onNotice={dictation?.onNotice}
        value={value}
      />
    </div>
  );
}

export function VoiceTextInput({ dictation, onChange, value, ...props }) {
  return (
    <div className="voiceTextControl inputVoiceControl">
      <input {...props} value={value} onChange={(event) => onChange?.(event.target.value)} />
      <DictationButton
        disabled={dictation?.disabled}
        onBusyChange={dictation?.onBusyChange}
        onChange={onChange}
        onNotice={dictation?.onNotice}
        value={value}
      />
    </div>
  );
}
