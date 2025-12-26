import React from "react";

export default function RightRailAd({ theme }: any) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: theme.surface2, borderColor: theme.border }}>
      <div className="px-3 py-2">
        <div className="text-sm font-extrabold" style={{ color: theme.text }}>
          Right Rail Ad
        </div>
      </div>

      <div className="px-3 pb-3">
        <div
          className="rounded-2xl border border-dashed flex items-center justify-center mx-auto w-full max-w-[300px] h-[250px]"
          style={{ borderColor: theme.border, background: theme.surface }}
        >
          <div className="text-sm font-semibold" style={{ color: theme.sub }}>
            300×250
          </div>
        </div>
      </div>
    </div>
  );
}
