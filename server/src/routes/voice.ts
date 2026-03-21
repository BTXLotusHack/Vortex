import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";

export const voiceRouter = Router();

voiceRouter.get("/conversation-token", optionalAuth, async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const configuredAgentId = process.env.ELEVENLABS_AGENT_ID || process.env.VITE_ELEVENLABS_AGENT_ID;
    const requestedAgentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
    const agentId = requestedAgentId || configuredAgentId;

    if (!apiKey || !agentId) {
      return res.status(204).send();
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      {
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs conversation token error:", errorText);
      return res.status(response.status).json({ error: "Failed to get conversation token" });
    }

    const body = await response.json().catch(() => null);
    if (!body?.token) {
      return res.status(500).json({ error: "Conversation token missing from ElevenLabs response" });
    }

    res.json({ token: body.token });
  } catch (error) {
    console.error("Conversation token error:", error);
    res.status(500).json({ error: "Failed to get conversation token" });
  }
});

// Text-to-Speech — proxy to ElevenLabs
voiceRouter.post("/tts", optionalAuth, async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";

    if (!apiKey) {
      return res.status(503).json({ error: "ElevenLabs not configured. Set ELEVENLABS_API_KEY." });
    }

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || defaultVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs TTS error:", errorText);
      return res.status(response.status).json({ error: "TTS generation failed" });
    }

    const audioBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error("TTS error:", error);
    res.status(500).json({ error: "Text-to-speech failed" });
  }
});

// Speech-to-Text — proxy to ElevenLabs
voiceRouter.post("/stt", optionalAuth, async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "ElevenLabs not configured" });
    }

    // Expect raw audio data in the request body
    const contentType = req.headers["content-type"] || "";

    // If multipart, read the file
    if (contentType.includes("multipart/form-data")) {
      const multer = (await import("multer")).default;
      const upload = multer({ storage: multer.memoryStorage() }).single("audio");

      return upload(req, res, async (err) => {
        if (err || !req.file) {
          return res.status(400).json({ error: "No audio file provided" });
        }

        const formData = new FormData();
        formData.append("file", new Blob([req.file.buffer]), "audio.webm");
        formData.append("model_id", "scribe_v2");
        formData.append("language_code", "eng");

        const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: formData,
        });

        if (!response.ok) {
          return res.status(response.status).json({ error: "STT failed" });
        }

        const transcription = await response.json();
        res.json(transcription);
      });
    }

    res.status(400).json({ error: "Expected multipart/form-data with audio file" });
  } catch (error) {
    console.error("STT error:", error);
    res.status(500).json({ error: "Speech-to-text failed" });
  }
});
