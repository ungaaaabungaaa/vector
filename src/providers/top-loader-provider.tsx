"use client";

import NextTopLoader from "nextjs-toploader";
import React from "react";

export function TopLoaderProvider() {
  return (
    <NextTopLoader
      height={2}
      showSpinner={false}
      color="var(--color-primary)"
    />
  );
}
