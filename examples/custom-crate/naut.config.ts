import { defineConfig } from "@cratenaut/core";

import { hello } from "./hello.crate";

const website = hello({
  id: "website",
  description: "产品欢迎页",
  options: {
    message: "Hello from a custom Crate",
    port: 8080,
  },
});

export default defineConfig({
  project: "custom-crate-example",
  servers: [
    {
      id: "local",
      connection: { kind: "local" },
      crates: [website],
    },
  ],
});
