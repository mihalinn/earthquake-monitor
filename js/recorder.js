/**
 * recorder.js
 * 震度データやEEW情報をバッファリングし、記録するためのモジュール
 */

const Recorder = (() => {
    let buffer = [];
    const MAX_BUFFER_SIZE = 600; // 10分間 (1秒1件想定)
    let isRecording = false;

    // 記録状態のUI更新
    function updateStatusUI(status) {
        const dot = document.getElementById('recorder-dot');
        const text = document.getElementById('recorder-status');
        if (!text) return;

        if (status === 'recording') {
            dot.style.color = '#ef4444';
            dot.style.animation = 'eewBlink 1s infinite';
            text.childNodes[2].textContent = ' 自動記録: 記録中...';
        } else {
            dot.style.color = 'var(--text-dim)';
            dot.style.animation = 'none';
            text.childNodes[2].textContent = ' 自動記録: 待機中';
        }
    }

    return {
        /**
         * データをバッファに追加
         */
        add(type, data) {
            const entry = {
                ts: Date.now(),
                type: type,
                data: data
            };
            buffer.push(entry);
            
            // バッファ溢れ防止
            if (buffer.length > MAX_BUFFER_SIZE * 3) {
                buffer.shift();
            }

            // EEW発令中なら自動的に記録状態へ
            if (type === 'eew' && data && !data.cancelled && !data.test) {
                const issueTime = new Date(data.issue.time.replace(/\//g, '-').replace(' ', 'T') + '+09:00').getTime();
                if (Date.now() - issueTime < 10 * 60 * 1000) {
                    if (!isRecording) {
                        isRecording = true;
                        updateStatusUI('recording');
                        console.log('[Recorder] EEW detect: Recording started');
                    }
                }
            }
        },

        /**
         * サーバーへ保存
         */
        async flush(eventId = 'earthquake') {
            if (buffer.length === 0) return;
            
            console.log(`[Recorder] Flushing ${buffer.length} records to server...`);
            try {
                const payload = {
                    eventId: eventId,
                    recordedAt: new Date().toISOString(),
                    records: buffer
                };

                const res = await fetch('/api/record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    console.log('[Recorder] Successfully saved to server');
                    // 保存後はバッファをクリア（または記録継続）
                    if (!isRecording) buffer = []; 
                }
            } catch (e) {
                console.error('[Recorder] Save failed', e);
            }
        },

        setRecording(val) {
            isRecording = val;
            updateStatusUI(val ? 'recording' : 'idle');
            if (!val) {
                this.flush(); // 停止時に保存
            }
        },

        getRecording() {
            return isRecording;
        }
    };
})();

// 手動記録のトグル
window.toggleManualRecord = function() {
    const isRecording = Recorder.getRecording();
    const btn = document.getElementById('manual-record-btn');
    
    if (!isRecording) {
        Recorder.setRecording(true);
        btn.innerHTML = '<i class="fa-solid fa-stop" style="margin-right: 4px;"></i>記録を停止して保存';
        btn.style.borderColor = '#ef4444';
        btn.style.color = '#ef4444';
    } else {
        Recorder.setRecording(false);
        btn.innerHTML = '<i class="fa-solid fa-record-vinyl" style="margin-right: 4px;"></i>手動記録開始';
        btn.style.borderColor = 'var(--border-hi)';
        btn.style.color = '#fff';
    }
};

// グローバルに公開
window.Recorder = Recorder;
