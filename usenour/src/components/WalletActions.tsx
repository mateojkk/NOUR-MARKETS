import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Copy, Check, X, Loader2, Droplets } from "lucide-react";
import { useEvmWallet } from "../contexts/EvmWalletContext";
import { ethers, parseUnits } from "ethers";
import { DREAMDEX_CONTRACTS } from "../services/dreamdex";
import "./WalletActions.css";

interface WalletActionsProps {
  walletAddress: string;
  usdcBalance: number;
  onTransactionComplete: () => void;
  executeGasless?: (txs: Array<{ to: string; data: string; value: string }>, desc: string) => Promise<any>;
}

type ModalType = "deposit" | "withdraw" | null;

export default function WalletActions({ walletAddress, usdcBalance, onTransactionComplete }: WalletActionsProps) {
  const { walletProvider, claimFaucet, refreshBalance } = useEvmWallet();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Withdraw state
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const closeModal = () => {
    setActiveModal(null);
    setRecipient("");
    setAmount("");
    setTxHash("");
    setError("");
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFaucetClaim = async () => {
    setClaiming(true);
    setError("");
    try {
      await claimFaucet();
      setClaimSuccess(true);
      await refreshBalance();
      onTransactionComplete();
      setTimeout(() => setClaimSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.reason || err?.message || "Faucet claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const handleWithdraw = async () => {
    if (!walletProvider) {
      setError("Wallet provider not connected");
      return;
    }
    if (!recipient || !amount) {
      setError("Please fill all fields");
      return;
    }
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setError("Invalid amount");
      return;
    }
    if (withdrawAmount > usdcBalance) {
      setError("Insufficient balance");
      return;
    }

    setSending(true);
    setError("");
    try {
      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        DREAMDEX_CONTRACTS.collateral,
        [
          "function transfer(address to, uint256 amount) returns (bool)",
        ],
        signer
      );

      const parsedAmount = parseUnits(amount, DREAMDEX_CONTRACTS.collateralDecimals);
      const tx = await contract.transfer(recipient, parsedAmount);
      setTxHash(tx.hash);
      await tx.wait();
      await refreshBalance();
      onTransactionComplete();
    } catch (err: any) {
      console.error("Transfer failed:", err);
      setError(err?.reason || err?.message || "Transfer failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="wallet-actions-bar">
        <button
          className="wallet-action-btn deposit"
          onClick={() => setActiveModal("deposit")}
        >
          <ArrowDownToLine size={16} />
          <span>Deposit</span>
        </button>

        <button
          className="wallet-action-btn withdraw"
          onClick={() => setActiveModal("withdraw")}
        >
          <ArrowUpFromLine size={16} />
          <span>Withdraw</span>
        </button>
      </div>

      {/* Deposit Modal */}
      {activeModal === "deposit" && (
        <div className="wallet-modal-overlay" onClick={closeModal}>
          <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wallet-modal-header">
              <h3>Deposit Collateral (Somnia Shannon)</h3>
              <button className="modal-close-btn" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="deposit-instructions">
                Send <strong>tUSDC</strong> or <strong>STT</strong> on <strong>Somnia Shannon Testnet</strong> (Chain ID 50312) to your address:
              </p>

              <div className="address-copy-box">
                <span className="address-text">{walletAddress}</span>
                <button className="copy-btn" onClick={handleCopy}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <div style={{ marginTop: "20px", paddingTop: "16px" }}>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px" }}>
                  Or instantly claim free testnet trading collateral:
                </p>
                <button
                  className="modal-action-btn"
                  onClick={handleFaucetClaim}
                  disabled={claiming}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <Droplets size={16} />
                  {claiming ? "Claiming Faucet..." : claimSuccess ? "Claimed 1,000 tUSDC!" : "Claim 1,000 Free tUSDC"}
                </button>

                {error && (
                  <div className="error-message" style={{ marginTop: "10px", wordBreak: "break-word" }}>
                    {error}
                  </div>
                )}
                {claimSuccess && (
                  <div className="success-message" style={{ marginTop: "10px" }}>
                    <Check size={16} />
                    <span>Successfully minted 1,000 tUSDC collateral!</span>
                  </div>
                )}

                <div style={{ marginTop: "12px", textAlign: "center" }}>
                  <a
                    href="https://cloud.google.com/application/web3/faucet/somnia/shannon"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "12px", color: "var(--primary)", textDecoration: "underline" }}
                  >
                    Need native STT gas? Somnia Shannon Faucet ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {activeModal === "withdraw" && (
        <div className="wallet-modal-overlay" onClick={closeModal}>
          <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wallet-modal-header">
              <h3>Withdraw tUSDC</h3>
              <button className="modal-close-btn" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="input-group">
                <label>Recipient Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  disabled={sending}
                />
              </div>

              <div className="input-group">
                <label>Amount (tUSDC)</label>
                <div className="amount-input-wrapper">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={sending}
                  />
                  <button
                    className="max-btn"
                    onClick={() => setAmount(usdcBalance.toString())}
                    type="button"
                  >
                    MAX
                  </button>
                </div>
                <span className="balance-hint">
                  Available: {usdcBalance.toFixed(2)} tUSDC
                </span>
              </div>

              {error && <div className="error-message">{error}</div>}

              {txHash ? (
                <div className="success-message">
                  <Check size={16} />
                  <span>Transfer Submitted! Tx: {txHash.slice(0, 10)}...</span>
                </div>
              ) : (
                <button
                  className="modal-action-btn"
                  onClick={handleWithdraw}
                  disabled={sending || !recipient || !amount}
                >
                  {sending ? (
                    <>
                      <Loader2 size={16} className="spin" /> Sending...
                    </>
                  ) : (
                    "Send tUSDC"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
