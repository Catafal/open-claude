// Type declarations for kokoro-js TTS module
declare module 'kokoro-js' {
  export interface KokoroOptions {
    dtype?: 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16';
    device?: 'cpu' | 'wasm' | 'webgpu';
  }

  export interface GenerateOptions {
    voice?: string;
  }

  export interface RawAudio {
    audio: Float32Array;
    sampling_rate: number;
  }

  export class KokoroTTS {
    static from_pretrained(model: string, options?: KokoroOptions): Promise<KokoroTTS>;
    generate(text: string, options?: GenerateOptions): Promise<RawAudio>;
    list_voices(): string[];
  }
}
