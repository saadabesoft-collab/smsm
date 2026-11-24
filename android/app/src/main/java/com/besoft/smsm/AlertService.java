package com.besoft.smsm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import org.json.JSONObject;

import java.io.File;
import java.util.Locale;

/**
 * Shows one reminder: posts the notification, opens the pop-up over other apps,
 * says "بفكرك بـ…" out loud and, for a voice note, plays the user's own recording.
 */
public class AlertService extends Service {
    static final String ACTION_ALERT = "com.besoft.smsm.ALERT";
    static final String ACTION_STOP = "com.besoft.smsm.STOP";
    static final String CH_MAIN = "smsm_alerts_v1";
    static final String CH_SOFT = "smsm_soft_v1";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextToSpeech tts;
    private boolean ttsReady;
    private boolean ttsInitDone;
    private MediaPlayer player;
    private JSONObject current;
    private String pendingSpeech;
    private AudioAttributes attrs;
    private Runnable afterSpeech;
    private Runnable timeout;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            int id = intent.getIntExtra("id", 0);
            boolean fin = intent.getBooleanExtra("final", false);
            if (current != null && (id == 0 || current.optInt("id") == id)) {
                if (fin) current = null;
                finish(true);
            } else if (current == null) stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_ALERT.equals(action)) {
            try {
                JSONObject it = new JSONObject(intent.getStringExtra("item"));
                if (current != null) finish(false);
                current = it;
                Notification n = build(this, it);
                int id = it.optInt("id");
                if (Build.VERSION.SDK_INT >= 29) {
                    startForeground(id, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                } else {
                    startForeground(id, n);
                }
                if (Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this)) {
                    try {
                        startActivity(popupIntent(this, it));
                    } catch (Exception ignored) {}
                }
                play(it);
            } catch (Exception e) {
                stopSelf();
            }
        }
        return START_NOT_STICKY;
    }

    static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel main = new NotificationChannel(CH_MAIN, "تذكيرات سمسم", NotificationManager.IMPORTANCE_HIGH);
        main.setDescription("سمسم بيفكرك بمهامك في معادها");
        main.setSound(null, null);
        main.enableVibration(true);
        main.setVibrationPattern(new long[]{0, 400, 200, 400});
        main.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(main);
        NotificationChannel soft = new NotificationChannel(CH_SOFT, "تقرير اليوم", NotificationManager.IMPORTANCE_DEFAULT);
        soft.setSound(null, null);
        nm.createNotificationChannel(soft);
    }

    static Intent popupIntent(Context c, JSONObject it) {
        Intent pop = new Intent(c, ReminderActivity.class);
        pop.putExtra("item", it.toString());
        pop.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return pop;
    }

    static Intent appIntent(Context c, String key, String act) {
        Intent open = new Intent(c, MainActivity.class);
        open.putExtra("smsm_key", key);
        open.putExtra("smsm_act", act);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return open;
    }

    static PendingIntent actionPi(Context c, JSONObject it, String act, int min, int salt) {
        Intent i = new Intent(c, ActionReceiver.class);
        i.setAction(ActionReceiver.ACTION + "." + act);
        i.putExtra("item", it.toString());
        i.putExtra("act", act);
        i.putExtra("min", min);
        return PendingIntent.getBroadcast(c, it.optInt("id") ^ salt, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static Notification build(Context c, JSONObject it) {
        ensureChannels(c);
        int id = it.optInt("id");
        String key = it.optString("key");
        boolean close = "close".equals(it.optString("kind"));
        int imm = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent popPi = PendingIntent.getActivity(c, id ^ 0x20000000, popupIntent(c, it), imm);
        PendingIntent reportPi = PendingIntent.getActivity(c, id ^ 0x08000000, appIntent(c, key, "report"), imm);

        String body = it.optString("body");
        String when = it.optString("when");
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, close ? CH_SOFT : CH_MAIN)
                .setSmallIcon(R.drawable.ic_stat_smsm)
                .setColor(0xFF2F7FE0)
                .setContentTitle(close ? it.optString("title") : "بفكرك بـ " + body)
                .setContentText(close ? body : (when.length() > 0 ? when : "سمسم بيفكرك"))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(close ? body : body + (when.length() > 0 ? "\n" + when : "")))
                .setContentIntent(close ? reportPi : popPi)
                .setOngoing(!close)
                .setAutoCancel(close)
                .setPriority(close ? NotificationCompat.PRIORITY_DEFAULT : NotificationCompat.PRIORITY_MAX)
                .setCategory(close ? NotificationCompat.CATEGORY_REMINDER : NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setWhen(System.currentTimeMillis())
                .setShowWhen(true);
        if (close) {
            b.addAction(0, "شوف التقرير", reportPi);
        } else {
            int def = it.optInt("snDef", 10);
            b.addAction(0, "تم ✓", actionPi(c, it, "done", 0, 0x01000000));
            b.addAction(0, "أجّل " + minLabel(def), actionPi(c, it, "snooze", def, 0x02000000));
            Intent mute = new Intent(c, AlertService.class);
            mute.setAction(ACTION_STOP);
            mute.putExtra("id", id);
            b.addAction(0, "اسكت", PendingIntent.getService(c, id ^ 0x04000000, mute, imm));
            b.setFullScreenIntent(popPi, true);
        }
        return b.build();
    }

    static String minLabel(int m) {
        if (m < 60) return m + " دقيقة";
        if (m == 60) return "ساعة";
        if (m == 120) return "ساعتين";
        if (m % 60 == 0) return (m / 60) + " ساعات";
        return m + " دقيقة";
    }

    private void play(JSONObject it) {
        String sound = it.optString("sound", "tts");
        attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
        if ("none".equals(sound)) {
            armTimeout(4000);
            return;
        }
        final String file = it.optString("file");
        final boolean hasNote = "note".equals(sound) && file.length() > 0 && new File(file).exists();
        afterSpeech = hasNote ? () -> playFile(file, true) : null;
        org.json.JSONArray steps = it.optJSONArray("steps");
        if (steps != null && steps.length() > 0 && it.optString("speechFile").length() == 0) {
            stepList = steps;
            stepIndex = 0;
            stepRate = (float) it.optDouble("rate", 1.0);
            voiceName = it.optString("voice");
            afterSpeech = null;
            armTimeout(4 * 60 * 1000);
            nextStep();
            return;
        }
        String clip = it.optString("speechFile");
        if (clip.length() > 0 && new File(clip).exists()) {
            playFile(clip, !hasNote);
            armTimeout(5 * 60 * 1000);
            return;
        }
        String text = it.optString("speech");
        float rate = (float) it.optDouble("rate", 1.0);
        voiceName = it.optString("voice");
        if (text.length() == 0) {
            if (afterSpeech != null) afterSpeech.run();
            else armTimeout(4000);
            return;
        }
        speak(text, rate);
        armTimeout(4 * 60 * 1000);
    }

    private String voiceName = "";
    private org.json.JSONArray stepList;
    private int stepIndex;
    private float stepRate = 1f;

    /** Recorded clips ("بفكّرك") and spoken text (the task itself), one after the other. */
    private void nextStep() {
        if (stepList == null || stepIndex >= stepList.length()) {
            stepList = null;
            finishCurrent();
            return;
        }
        JSONObject st = stepList.optJSONObject(stepIndex++);
        if (st == null) {
            nextStep();
            return;
        }
        String a = st.optString("a");
        if (a.length() > 0) {
            try {
                releasePlayer();
                android.content.res.AssetFileDescriptor afd = getAssets().openFd(a);
                player = new MediaPlayer();
                player.setAudioAttributes(attrs);
                player.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                afd.close();
                player.setOnCompletionListener(mp -> handler.post(this::nextStep));
                player.setOnErrorListener((mp, w, e) -> {
                    handler.post(this::nextStep);
                    return true;
                });
                player.prepare();
                player.start();
            } catch (Exception e) {
                releasePlayer();
                handler.post(this::nextStep);
            }
            return;
        }
        String t = st.optString("t");
        if (t.length() == 0) {
            nextStep();
            return;
        }
        afterSpeech = this::nextStep;
        speak(t, stepRate);
    }

    /** last=true: the reminder is over when this file ends; otherwise go on to the voice note. */
    private void playFile(String path, boolean last) {
        try {
            releasePlayer();
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            player.setDataSource(path);
            player.setOnCompletionListener(mp -> handler.post(last ? this::finishCurrent : this::afterSpeak));
            player.setOnErrorListener((mp, w, e) -> {
                handler.post(last ? this::finishCurrent : this::afterSpeak);
                return true;
            });
            player.prepare();
            player.start();
            armTimeout(5 * 60 * 1000);
        } catch (Exception e) {
            releasePlayer();
            finishCurrent();
        }
    }

    private float speechRate = 1f;

    private void speak(String text, float rate) {
        pendingSpeech = text;
        speechRate = rate;
        if (tts == null) {
            tts = new TextToSpeech(getApplicationContext(), status -> {
                ttsInitDone = true;
                ttsReady = status == TextToSpeech.SUCCESS;
                if (ttsReady) ttsReady = setArabic(tts);
                handler.post(this::doSpeak);
            });
        } else if (ttsInitDone) {
            doSpeak();
        }
    }

    static void applyVoice(TextToSpeech t, String name) {
        if (t == null || name == null || name.length() == 0) return;
        try {
            for (android.speech.tts.Voice v : t.getVoices()) {
                if (name.equals(v.getName())) {
                    t.setVoice(v);
                    return;
                }
            }
        } catch (Exception ignored) {}
    }

    static boolean setArabic(TextToSpeech t) {
        int r = t.setLanguage(new Locale("ar", "EG"));
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) r = t.setLanguage(new Locale("ar"));
        return !(r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED);
    }

    private void afterSpeak() {
        Runnable next = afterSpeech;
        afterSpeech = null;
        if (next != null) next.run();
        else finishCurrent();
    }

    private void doSpeak() {
        if (pendingSpeech == null) return;
        if (!ttsReady) {
            pendingSpeech = null;
            handler.postDelayed(this::afterSpeak, 1500);
            return;
        }
        tts.setAudioAttributes(attrs);
        applyVoice(tts, voiceName);
        tts.setSpeechRate(0.95f * speechRate);
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) { handler.post(AlertService.this::afterSpeak); }
            @Override public void onError(String id) { handler.post(AlertService.this::afterSpeak); }
        });
        Bundle p = new Bundle();
        p.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1f);
        tts.speak(pendingSpeech, TextToSpeech.QUEUE_FLUSH, p, "smsm" + System.currentTimeMillis());
        pendingSpeech = null;
    }

    private void armTimeout(long ms) {
        if (timeout != null) handler.removeCallbacks(timeout);
        timeout = this::finishCurrent;
        handler.postDelayed(timeout, ms);
    }

    private void releasePlayer() {
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) {}
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }
    }

    private void finishCurrent() {
        finish(true);
    }

    /** Stop the sound, keep the notification, and ring again later until تم or تأجيل is pressed. */
    private void finish(boolean stopService) {
        if (timeout != null) handler.removeCallbacks(timeout);
        timeout = null;
        afterSpeech = null;
        stepList = null;
        releasePlayer();
        pendingSpeech = null;
        if (tts != null) {
            try { tts.stop(); } catch (Exception ignored) {}
        }
        JSONObject it = current;
        current = null;
        if (it != null) {
            String key = it.optString("key");
            int id = it.optInt("id");
            if (it.optBoolean("persistent") && !Scheduler.isDismissed(this, key)) {
                long rep = it.optLong("repeat", 3) * 60000L;
                long next = System.currentTimeMillis() + rep;
                long exp = it.optLong("exp", 0);
                if (rep > 0 && (exp == 0 || next < exp)) {
                    try {
                        JSONObject copy = new JSONObject(it.toString());
                        copy.put("time", next);
                        Scheduler.setAlarm(this, id | Scheduler.REPEAT_FLAG, next, copy.toString());
                    } catch (Exception ignored) {}
                }
            }
        }
        if (stopService) {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH);
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        releasePlayer();
        if (tts != null) {
            try { tts.shutdown(); } catch (Exception ignored) {}
            tts = null;
        }
        super.onDestroy();
    }
}
