import { Buffer } from 'buffer';
window.Buffer = Buffer;

import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { dedicatedWalletConnector } from '@magiclabs/wagmi-connector'
import { injected } from 'wagmi/connectors'
import { defineChain } from 'viem'
import './index.css'
import App from './App.tsx'
import { EvmWalletProvider } from './contexts/EvmWalletContext.tsx'
import { ProfileProvider } from './contexts/ProfileContext.tsx'

// Define Somnia Shannon Testnet
export const somniaShannonTestnet = defineChain({
  id: 50312,
  name: 'Somnia Shannon Testnet',
  nativeCurrency: {
    name: 'STT',
    symbol: 'STT',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://50312.rpc.thirdweb.com', 'https://dream-rpc.somnia.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Shannon Explorer',
      url: 'https://shannon-explorer.somnia.network',
    },
  },
  testnet: true,
})

const connectors: any[] = [injected({ shimDisconnect: true })];

const magicKey = import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY?.trim();
const somniaRpcUrl = import.meta.env.VITE_SOMNIA_RPC_URL || 'https://50312.rpc.thirdweb.com';

if (magicKey) {
  connectors.push(
    dedicatedWalletConnector({
      chains: [somniaShannonTestnet],
      options: {
        apiKey: magicKey,
        magicSdkConfiguration: {
          network: {
            rpcUrl: somniaRpcUrl,
            chainId: 50312,
          },
        },
        enableEmailLogin: true,
      },
    })
  );
}

const wagmiConfig = createConfig({
  chains: [somniaShannonTestnet],
  connectors,
  transports: {
    [somniaShannonTestnet.id]: http(somniaRpcUrl),
  },
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <EvmWalletProvider>
          <ProfileProvider>
            <App />
          </ProfileProvider>
        </EvmWalletProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </WagmiProvider>,
)
