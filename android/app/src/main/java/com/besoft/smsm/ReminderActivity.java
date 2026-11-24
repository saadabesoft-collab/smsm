package com.besoft.smsm;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

/** The pop-up card shown over other apps and over the lock screen: "بفكرك بـ…" with تم / أجّل. */
public class ReminderActivity extends Activity {
    private JSONObject item;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        render(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        render(intent);
    }

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private GradientDrawable round(int color, float radiusDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(radiusDp));
        return g;
    }

    private TextView text(String s, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setLineSpacing(0, 1.2f);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private Button button(String s, int bg, int fg, float sp) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        b.setTextColor(fg);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setBackground(round(bg, 16));
        b.setMinHeight(dp(52));
        b.setStateListAnimator(null);
        return b;
    }

    private LinearLayout.LayoutParams full(int top) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.setMargins(0, dp(top), 0, 0);
        return p;
    }

    private void stopSound() {
        Intent stop = new Intent(this, AlertService.class);
        stop.setAction(AlertService.ACTION_STOP);
        stop.putExtra("id", item != null ? item.optInt("id") : 0);
        try { startService(stop); } catch (Exception ignored) {}
    }

    private void render(Intent intent) {
        try {
            item = new JSONObject(intent.getStringExtra("item"));
        } catch (Exception e) {
            finish();
            return;
        }
        final String json = item.toString();
        final boolean close = "close".equals(item.optString("kind"));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xB30C0A28);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        ScrollView scroll = new ScrollView(this);
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        sp.setMargins(dp(18), dp(24), dp(18), dp(24));
        root.addView(scroll, sp);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(round(Color.WHITE, 28));
        card.setClipToOutline(true);
        scroll.addView(card, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        GradientDrawable head = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF2B2A6B, 0xFF4A3F9E});
        float r = dp(28);
        head.setCornerRadii(new float[]{r, r, r, r, 0, 0, 0, 0});
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setGravity(Gravity.CENTER_HORIZONTAL);
        header.setBackground(head);
        header.setPadding(dp(20), dp(18), dp(20), dp(14));
        ImageView genie = new ImageView(this);
        genie.setImageResource(R.drawable.genie);
        genie.setClipToOutline(true);
        genie.setBackground(round(0xFF2B2A6B, 22));
        header.addView(genie, new LinearLayout.LayoutParams(dp(84), dp(84)));
        TextView brand = text(close ? "سمسم — آخر اليوم" : "سمسم بيفكرك", 15, 0xE6FFFFFF, false);
        brand.setPadding(0, dp(6), 0, 0);
        header.addView(brand);
        card.addView(header);

        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(20), dp(16), dp(20), dp(18));
        card.addView(body);

        if (close) {
            body.addView(text(item.optString("title"), 22, 0xFF1D1B3F, true));
            body.addView(text(item.optString("body"), 17, 0xFF55527A, false), full(6));
            Button open = button("شوف التقرير", 0xFF6C5CE7, Color.WHITE, 18);
            body.addView(open, full(18));
            open.setOnClickListener(v -> {
                ActionReceiver.handle(this, json, "close", 0);
                startActivity(AlertService.appIntent(this, item.optString("key"), "report"));
                finish();
            });
            Button later = button("بعدين", 0xFFEFECFF, 0xFF1D1B3F, 16);
            body.addView(later, full(10));
            later.setOnClickListener(v -> {
                ActionReceiver.handle(this, json, "close", 0);
                finish();
            });
            setContentView(root);
            return;
        }

        body.addView(text("بفكرك بـ", 14, 0xFF8A86B0, false));
        body.addView(text(item.optString("body"), 26, 0xFF1D1B3F, true), full(2));
        String when = item.optString("when");
        int sn = item.optInt("snoozed", 0);
        if (sn > 0) when = when + (when.length() > 0 ? " · " : "") + "اتأجل " + sn + " مرة";
        if (when.length() > 0) body.addView(text(when, 14, 0xFF8A86B0, false), full(4));
        if ("note".equals(item.optString("sound"))) {
            TextView note = text("🎙 بيشغّل الفويس نوت بتاعتك", 14, 0xFF2BB7A8, true);
            body.addView(note, full(8));
        }

        Button done = button("تم ✓", 0xFF22A88F, Color.WHITE, 20);
        done.setMinHeight(dp(60));
        body.addView(done, full(18));
        done.setOnClickListener(v -> {
            ActionReceiver.handle(this, json, "done", 0);
            finish();
        });

        body.addView(text("أو أجّل:", 14, 0xFF8A86B0, false), full(14));
        JSONArray sz = item.optJSONArray("snooze");
        if (sz == null || sz.length() == 0) sz = new JSONArray().put(5).put(10).put(15).put(30).put(60);
        LinearLayout row = null;
        for (int i = 0; i < sz.length(); i++) {
            if (i % 3 == 0) {
                row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                body.addView(row, full(8));
            }
            final int m = sz.optInt(i);
            Button b = button(AlertService.minLabel(m), 0xFFFFE6DC, 0xFF3B1A0C, 15);
            b.setMinHeight(dp(48));
            LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            bp.setMargins(dp(4), 0, dp(4), 0);
            row.addView(b, bp);
            b.setOnClickListener(v -> {
                ActionReceiver.handle(this, json, "snooze", m);
                finish();
            });
        }
        int rest = sz.length() % 3;
        if (rest != 0 && row != null) {
            for (int i = rest; i < 3; i++) {
                View pad = new View(this);
                LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(0, 1, 1f);
                bp.setMargins(dp(4), 0, dp(4), 0);
                row.addView(pad, bp);
            }
        }

        Button mute = button("اسكت الصوت", Color.TRANSPARENT, 0xFF6C5CE7, 15);
        body.addView(mute, full(8));
        mute.setOnClickListener(v -> {
            stopSound();
            mute.setVisibility(View.GONE);
        });

        TextView foot = text("BeSoft", 12, 0xFFA6A3CF, false);
        foot.setPadding(0, dp(4), 0, 0);
        body.addView(foot, full(0));
        setContentView(root);
    }

    @Override
    public void onBackPressed() {
        stopSound();
        super.onBackPressed();
    }
}
