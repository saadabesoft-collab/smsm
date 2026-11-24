package com.besoft.smsm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/** Stores the reminder list handed over from the web app and keeps exact alarms for it. */
public final class Scheduler {
    static final String PREFS = "smsm_native";
    static final String ACTION_ALARM = "com.besoft.smsm.ALARM";
    static final int REPEAT_FLAG = 0x40000000;

    private Scheduler() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static PendingIntent alarmIntent(Context c, int requestCode, String itemJson, int flags) {
        Intent i = new Intent(c, AlarmReceiver.class);
        i.setAction(ACTION_ALARM);
        if (itemJson != null) i.putExtra("item", itemJson);
        return PendingIntent.getBroadcast(c, requestCode, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    static void setAlarm(Context c, int requestCode, long at, String itemJson) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = alarmIntent(c, requestCode, itemJson, PendingIntent.FLAG_UPDATE_CURRENT);
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        try {
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    static void cancelAlarm(Context c, int requestCode) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = alarmIntent(c, requestCode, null, PendingIntent.FLAG_NO_CREATE);
        if (am != null && pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    /** Replace the whole schedule with a new list of items from the web app. */
    static synchronized void replaceAll(Context c, JSONArray items) {
        SharedPreferences p = prefs(c);
        try {
            JSONArray old = new JSONArray(p.getString("ids", "[]"));
            for (int i = 0; i < old.length(); i++) cancelAlarm(c, old.getInt(i));
        } catch (Exception ignored) {}
        p.edit().putString("items", items.toString()).apply();
        scheduleStored(c);
    }

    /** (Re)arm alarms for every stored item that is still in the future. Used after boot too. */
    static synchronized void scheduleStored(Context c) {
        SharedPreferences p = prefs(c);
        JSONArray ids = new JSONArray();
        try {
            JSONArray items = new JSONArray(p.getString("items", "[]"));
            long now = System.currentTimeMillis();
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.getJSONObject(i);
                long t = it.optLong("time");
                int id = it.optInt("id");
                if (t <= now || isDismissed(c, it.optString("key"))) continue;
                setAlarm(c, id, t, it.toString());
                ids.put(id);
            }
        } catch (Exception ignored) {}
        p.edit().putString("ids", ids.toString()).apply();
    }

    static boolean isDismissed(Context c, String key) {
        if (key == null) return false;
        try {
            JSONObject d = new JSONObject(prefs(c).getString("dismissed", "{}"));
            return d.has(key);
        } catch (Exception e) {
            return false;
        }
    }

    static synchronized void markDismissed(Context c, String key) {
        if (key == null) return;
        SharedPreferences p = prefs(c);
        try {
            JSONObject d = new JSONObject(p.getString("dismissed", "{}"));
            long now = System.currentTimeMillis();
            d.put(key, now);
            JSONObject pruned = new JSONObject();
            java.util.Iterator<String> it = d.keys();
            while (it.hasNext()) {
                String k = it.next();
                if (now - d.optLong(k) < 4L * 24 * 3600 * 1000) pruned.put(k, d.optLong(k));
            }
            p.edit().putString("dismissed", pruned.toString()).apply();
        } catch (Exception ignored) {}
    }

    /** Remember what the user pressed in the pop-up / notification so the web app can catch up. */
    static synchronized void addAck(Context c, JSONObject ack) {
        SharedPreferences p = prefs(c);
        try {
            JSONArray acks = new JSONArray(p.getString("acks", "[]"));
            acks.put(ack);
            p.edit().putString("acks", acks.toString()).apply();
        } catch (Exception ignored) {}
    }

    static synchronized JSONArray takeAcks(Context c) {
        SharedPreferences p = prefs(c);
        JSONArray a;
        try {
            a = new JSONArray(p.getString("acks", "[]"));
        } catch (Exception e) {
            a = new JSONArray();
        }
        p.edit().putString("acks", "[]").apply();
        return a;
    }
}
