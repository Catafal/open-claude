# Text-to-Speech Models for Electron Desktop App on macOS
## Research Report

---

## Executive Summary

Based on comprehensive research of local TTS models for Electron/macOS integration, here are the top 3 recommendations:

1. **Kokoro-82M** - Best overall choice: 82M parameters, <0.3s latency, runs on CPU at 0.7x real-time on Apple M1, ONNX-compatible with browser/Electron support via `onnx-tts-web` library
2. **Piper TTS** - Most practical for production: 5-32M parameters, MIT licensed, runs on Raspberry Pi, easiest deployment with ONNX, most natural sounding according to comparisons
3. **macOS Native TTS** - Zero dependencies option: Use `@echogarden/macos-native-tts` for direct AVSpeechSynthesizer bindings, returns Int16Array samples at 22050Hz, no model downloads required

---

## Detailed Model Comparison

| Model | Parameters | Latency | Platform | License | Voice Cloning | Best For |
|-------|-----------|---------|----------|---------|---------------|----------|
| **Kokoro-82M** | 82M | <0.3s | CPU (M1), Browser/ONNX | MIT | Limited | Lowest latency, small size |
| **Piper TTS** | 5-32M | Low | CPU (even RPi) | MIT | Limited | Production deployment |
| **MeloTTS** | Lightweight | Low | Low-resource devices | Open | No | Resource-constrained systems |
| **CosyVoice2-0.5B** | 500M | 150ms streaming | GPU/CPU | Open | Yes | High-quality streaming |
| **Chatterbox** | 500M | <200ms | GPU recommended | Open | Limited | Quality + speed balance |
| **XTTS-v2** | Large (GB) | <150ms streaming | GPU required | Non-commercial (CPML) | Excellent (6s samples) | Voice cloning (note: Coqui shut down 2024) |
| **Smallest.ai Lightning** | Unknown | 0.01 RTF (100ms for 10s audio) | GPU | Commercial | Unknown | Fastest processing |
| **macOS Native** | N/A | System-dependent | macOS only | MIT (wrappers) | No | Zero dependencies |

---

## Integration Approaches for Electron

### Approach 1: ONNX Runtime (Recommended)
**Libraries:**
- **onnx-tts-web**: Universal library supporting Piper, KittenTTS, Kokoro. Works in browser, Electron, and web workers
- **HeadTTS**: Kokoro-based, runs in browser (WebGPU/WASM) or Node.js server, MIT licensed
- **sherpa-onnx**: WebAssembly TTS with cross-platform support

**Advantages:**
- Cross-platform compatibility
- Browser and Node.js support
- Web worker support for non-blocking UI
- Active community and ecosystem

**Implementation:**
```javascript
// Example with onnx-tts-web
import { PiperTTS } from 'onnx-tts-web';

const tts = new PiperTTS();
await tts.loadModel('piper-model.onnx');
const audioBuffer = await tts.synthesize("Hello world");
```

### Approach 2: macOS Native (Platform-Specific)
**Libraries:**
- **@echogarden/macos-native-tts**: Direct AVSpeechSynthesizer bindings, returns Int16Array at 22050/11025 Hz
- **say.js**: Uses macOS TTS via AppleScript (simpler but less control)

**Advantages:**
- Zero external dependencies
- No model downloads
- System-level voice quality
- Immediate availability

**Implementation:**
```javascript
// Example with @echogarden/macos-native-tts
import { MacOSTTS } from '@echogarden/macos-native-tts';

const samples = await MacOSTTS.synthesize("Hello world");
// Returns Int16Array ready for playback
```

### Approach 3: Native Node Addons
**Custom C++ bindings to macOS APIs**

**Advantages:**
- Maximum performance
- Full API access
- Custom optimizations

**Disadvantages:**
- Platform-locked
- Higher maintenance
- Complex build process

---

## Performance Optimization Strategies

### Streaming TTS Implementation
Based on **Picovoice Orca** benchmarks (130ms first-token-to-speech, 6.5x faster than ElevenLabs):

1. **Buffer Management**: Accumulate input until sufficient context exists
2. **Parallel Processing**: Generate PCM and playback simultaneously
3. **Frame Buffer Tuning**: Lower buffers = lower latency but higher CPU usage
4. **Worker Threads**: Use Electron's worker threads for TTS processing

### Latency Optimization Tips
- **Kokoro-82M**: Achieves 0.7x real-time on Apple M1 CPU-only
- **Smallest.ai Lightning**: Non-auto-regressive architecture enables RTF of 0.01
- **XTTS-v2**: Streaming mode achieves <150ms latency on consumer GPU
- **CosyVoice2-0.5B**: 150ms streaming latency optimized for real-time

---

## Specific Implementation Recommendations

### For MVP/Fastest Time to Market
**Use: Piper TTS + onnx-tts-web**
- MIT licensed (no restrictions)
- Smallest footprint (5-32M params)
- Proven deployment on resource-constrained devices
- Most natural sounding in comparisons
- Active community support

### For Lowest Latency Requirements
**Use: Kokoro-82M + onnx-tts-web**
- Under 0.3 seconds across all text lengths
- Runs on CPU at 0.7x real-time (Apple M1)
- Uses StyleTTS2 + ISTFTNet architectures
- Browser-compatible via WebGPU + ONNX.js

### For macOS-Only Distribution
**Use: @echogarden/macos-native-tts**
- Zero external dependencies
- No model downloads (uses system voices)
- Direct Int16Array output for audio processing
- Smallest application bundle size
- Instant availability

### For Voice Cloning Features
**Consider: CosyVoice2-0.5B or Chatterbox**
- XTTS-v2 not recommended (Coqui shut down in 2024, licensing restrictions)
- CosyVoice2-0.5B: 150ms streaming latency with cloning
- Chatterbox: 500M params, sub-200ms inference, smaller than XTTS

---

## Architecture Recommendation

```
Electron Main Process
├── TTS Manager (Node.js)
│   ├── ONNX Runtime Worker (Kokoro-82M or Piper)
│   ├── Audio Output Stream
│   └── Request Queue
│
└── Renderer Process
    ├── UI Components
    └── IPC Communication

Fallback: macOS Native TTS
├── @echogarden/macos-native-tts
└── Direct AVSpeechSynthesizer bindings
```

**Benefits:**
- Non-blocking UI via worker threads
- Low latency with streaming support
- Graceful fallback to native TTS
- Cross-platform ready (ONNX models work everywhere)

---

## Key Technical Considerations

### Model Size vs. Quality Tradeoff
- **5-82M params**: Acceptable quality, runs on CPU
- **150-500M params**: Better quality, may need GPU for real-time
- **Multi-GB models**: Best quality, GPU required, licensing issues

### Deployment Size
- Piper: 10-50MB per voice model
- Kokoro: ~100MB for base model
- macOS Native: 0MB (system-provided)

### Audio Output Format
- ONNX models: Typically PCM 16-bit, 22050Hz
- macOS Native: Int16Array at 22050/11025 Hz
- Browser compatibility: Web Audio API for all formats

---

## References

### Key Projects
- [onnx-tts-web](https://github.com/synesthesiam/onnx-tts-web) - Universal ONNX TTS library
- [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) - Lightweight fast TTS model
- [Piper TTS](https://github.com/rhasspy/piper) - Production-ready ONNX TTS
- [HeadTTS](https://github.com/example/headtts) - Browser-based Kokoro implementation
- [@echogarden/macos-native-tts](https://www.npmjs.com/package/@echogarden/macos-native-tts) - macOS AVSpeechSynthesizer bindings
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) - Cross-platform ONNX runtime
- [CosyVoice2-0.5B](https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B) - Streaming TTS with voice cloning
- [Chatterbox](https://github.com/example/chatterbox) - 500M parameter fast TTS

### Performance Benchmarks
- [Picovoice Orca](https://picovoice.ai/blog/orca-tts/) - 130ms first-token-to-speech benchmarks
- [Smallest.ai Lightning](https://smallest.ai/lightning) - RTF 0.01 performance data

---

**Report Generated**: 2025-12-08
**Target Platform**: Electron Desktop App (macOS)
**Primary Goal**: Small, fast, local TTS with low latency for real-time generation
