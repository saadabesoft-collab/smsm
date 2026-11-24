package com.besoft.smsm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

/** Fired by AlarmManager at a reminder's time; hands the reminder to AlertService. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String json = intent.getStringExtra("item");
        if (json == null) return;
        try {
            JSONObject it = new JSONObject(json);
            if (Scheduler.isDismissed(c, it.optString("key"))) return;
            long exp = it.optLong("exp", 0);
            if (exp > 0 && System.currentTimeMillis() > exp) return;
            Intent s = new Intent(c, AlertService.class);
            s.setAction(AlertService.ACTION_ALERT);
            s.putExtra("item", json);
            ContextCompat.startForegroundService(c, s);
        } catch (Exception ignored) {}
    }
}
