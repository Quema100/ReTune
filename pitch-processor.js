class PitchProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        this.fftSize = 4096; 
        this.hopSize = this.fftSize / 4;  
        this.half = this.fftSize / 2;
        this.bufferSize = 16384; 

        this.inputBuffer = [];
        this.outputBuffer = [];
        
        this.phaseAccum = [];
        this.prevPhase = [];

        this.re = new Float32Array(this.fftSize);
        this.im = new Float32Array(this.fftSize);
        this.mag = new Float32Array(this.half + 1);
        this.phase = new Float32Array(this.half + 1);
        this.newMag = new Float32Array(this.half + 1);
        this.newPhase = new Float32Array(this.half + 1);
        this.isPeak = new Uint8Array(this.half + 1);
        this.peakMap = new Int32Array(this.half + 1);
        this.maxMagMap = new Float32Array(this.half + 1); 

        this.window = new Float32Array(this.fftSize);
        for (let i = 0; i < this.fftSize; i++) {
            this.window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / this.fftSize));
        }

        this.writePos = 0;
        this.frameCounter = 0;
        this.smoothedPitch = 1.0; 
    }

    static get parameterDescriptors() {
        return [{ name: 'pitch', defaultValue: 1.0, minValue: 0.5, maxValue: 2.5 }];
    }

    princArg(x) {
        return ((x + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    }

    fft(real, imag) {
        const n = real.length;
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                let tr = real[i]; real[i] = real[j]; real[j] = tr;
                let ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
            }
        }
        for (let len = 2; len <= n; len <<= 1) {
            let ang = 2 * Math.PI / len;
            let wr = Math.cos(ang), wi = Math.sin(ang);
            for (let i = 0; i < n; i += len) {
                let ur = 1, ui = 0;
                for (let j = 0; j < len / 2; j++) {
                    let a = i + j, b = a + len / 2;
                    let tr = real[b] * ur - imag[b] * ui;
                    let ti = real[b] * ui + imag[b] * ur;
                    real[b] = real[a] - tr; imag[b] = imag[a] - ti;
                    real[a] += tr; imag[a] += ti;
                    let tmp = ur * wr - ui * wi;
                    ui = ur * wi + ui * wr; ur = tmp;
                }
            }
        }
    }

    ifft(real, imag) {
        const n = real.length;
        for (let i = 0; i < n; i++) imag[i] = -imag[i];
        this.fft(real, imag);
        for (let i = 0; i < n; i++) { real[i] /= n; imag[i] = -imag[i] / n; }
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        const targetPitch = parameters.pitch[0];

        if (!input || !input[0]) return true;
        const numChannels = input.length;
        const frameLen = input[0].length;
        const N = this.fftSize;
        const half = this.half;

        if (this.inputBuffer.length !== numChannels) {
            this.inputBuffer = Array.from({ length: numChannels }, () => new Float32Array(this.bufferSize));
            this.outputBuffer = Array.from({ length: numChannels }, () => new Float32Array(this.bufferSize));
            this.phaseAccum = Array.from({ length: numChannels }, () => new Float32Array(half + 1));
            this.prevPhase = Array.from({ length: numChannels }, () => new Float32Array(half + 1));
        }

        this.smoothedPitch += (targetPitch - this.smoothedPitch) * 0.05;
        const pitch = this.smoothedPitch;
        const expectedAdvance = 2 * Math.PI * this.hopSize / N;

        for (let i = 0; i < frameLen; i++) {
            for (let c = 0; c < numChannels; c++) {
                this.inputBuffer[c][this.writePos] = input[c][i];
            }

            if (this.frameCounter % this.hopSize === 0) {
                for (let c = 0; c < numChannels; c++) {
                    
                    for (let j = 0; j < N; j++) {
                        let idx = (this.writePos - N + j + this.bufferSize) % this.bufferSize;
                        this.re[j] = this.inputBuffer[c][idx] * this.window[j];
                        this.im[j] = 0;
                    }
                    this.fft(this.re, this.im);

                    let maxMag = 0;
                    for (let k = 0; k <= half; k++) {
                        this.mag[k] = Math.hypot(this.re[k], this.im[k]);
                        this.phase[k] = Math.atan2(this.im[k], this.re[k]);
                        if (this.mag[k] > maxMag) maxMag = this.mag[k];
                        
                        this.newMag[k] = 0;
                        this.newPhase[k] = 0;
                        this.maxMagMap[k] = -1;
                    }

                    const threshold = maxMag * 0.05; 

                    for (let k = 1; k < half; k++) {
                        this.isPeak[k] = (this.mag[k] > this.mag[k-1] && 
                                          this.mag[k] > this.mag[k+1] && 
                                          this.mag[k] > threshold) ? 1 : 0;
                    }
                    this.isPeak[0] = 0; this.isPeak[half] = 0;

                    let lastP = 0, nextP = 0;
                    for (let k = 0; k <= half; k++) if (this.isPeak[k]) { nextP = k; break; }
                    for (let k = 0; k <= half; k++) {
                        if (this.isPeak[k]) {
                            lastP = k; nextP = k;
                            for (let j = k + 1; j <= half; j++) if (this.isPeak[j]) { nextP = j; break; }
                        }
                        this.peakMap[k] = (k - lastP <= nextP - k) ? lastP : nextP;
                        if (lastP === 0 && nextP === 0) this.peakMap[k] = k; 
                    }

                    for (let k = 0; k <= half; k++) {
                        if (this.peakMap[k] === k) {
                            let expected = k * expectedAdvance;
                            let delta = this.princArg(this.phase[k] - this.prevPhase[c][k] - expected);
                            this.phaseAccum[c][k] = this.princArg(this.phaseAccum[c][k] + (expected + delta) * pitch);
                        }
                    }

                    if (pitch >= 1.0) {
                        for (let k = 0; k <= half; k++) {
                            let src_k = k / pitch; 
                            let k0 = Math.floor(src_k);
                            let k1 = k0 + 1;

                            if (k0 >= half) continue;

                            let frac = src_k - k0;
                            let mag0 = this.mag[k0];
                            let mag1 = (k1 <= half) ? this.mag[k1] : 0;
                            this.newMag[k] = mag0 + (mag1 - mag0) * frac;

                            let k_near = Math.round(src_k);
                            if (k_near > half) k_near = half;
                            
                            if (this.mag[k_near] > threshold) {
                                let p = this.peakMap[k_near]; 
                                this.newPhase[k] = this.princArg(this.phaseAccum[c][p] + this.phase[k_near] - this.phase[p]);
                            } else {
                                this.newPhase[k] = (Math.random() * 2 * Math.PI) - Math.PI;
                            }
                        }
                    } else {
                        for (let k = 0; k <= half; k++) {
                            let new_k = Math.round(k * pitch);
                            if (new_k > half) continue;

                            this.newMag[new_k] += this.mag[k]; 

                            if (this.mag[k] > this.maxMagMap[new_k]) {
                                this.maxMagMap[new_k] = this.mag[k];
                                
                                if (this.mag[k] > threshold) {
                                    let p = this.peakMap[k];
                                    this.newPhase[new_k] = this.princArg(this.phaseAccum[c][p] + this.phase[k] - this.phase[p]);
                                } else {
                                    this.newPhase[new_k] = (Math.random() * 2 * Math.PI) - Math.PI;
                                }
                            }
                        }
                    }

                    for (let k = 0; k <= half; k++) {
                        this.prevPhase[c][k] = this.phase[k];
                    }

                    for (let k = 0; k <= half; k++) {
                        this.re[k] = this.newMag[k] * Math.cos(this.newPhase[k]);
                        this.im[k] = this.newMag[k] * Math.sin(this.newPhase[k]);
                        if (k > 0 && k < half) {
                            this.re[N - k] = this.re[k];
                            this.im[N - k] = -this.im[k];
                        }
                    }

                    this.ifft(this.re, this.im);

                    for (let j = 0; j < N; j++) {
                        let idx = (this.writePos - N + j + this.bufferSize) % this.bufferSize;
                        this.outputBuffer[c][idx] += this.re[j] * this.window[j] / 1.5; 
                    }
                }
            }

            for (let c = 0; c < numChannels; c++) {
                let outIdx = (this.writePos - N - this.hopSize + this.bufferSize) % this.bufferSize;
                let val = this.outputBuffer[c][outIdx];
                this.outputBuffer[c][outIdx] = 0; 

                val *= 2.0;
                output[c][i] = Math.tanh(val); 
            }

            this.writePos = (this.writePos + 1) % this.bufferSize;
            this.frameCounter++;
        }
        return true;
    }
}

registerProcessor('pitch-processor', PitchProcessor);