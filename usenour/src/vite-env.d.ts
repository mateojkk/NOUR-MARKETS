/// <reference types="vite/client" />

type Eip1193Provider = import("ethers").Eip1193Provider;

interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon?: string;
  rdns?: string;
}

interface Eip6963ProviderDetail {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
}

interface Window {
  ethereum?: Eip1193Provider;
}

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

import { Buffer } from 'buffer';

declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}
