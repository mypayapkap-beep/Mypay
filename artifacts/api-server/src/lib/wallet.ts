import { db } from "@workspace/db";
import {
  walletsTable,
  walletLedgerTable,
  walletLockLogsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import crypto from "crypto";

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export async function createWalletForUser(userId: string): Promise<void> {
  await db
    .insert(walletsTable)
    .values({ userId, inrBalance: "0.00", usdtBalance: "0.00000000" })
    .onConflictDoNothing();
}

export async function creditWallet(params: {
  userId: string;
  amount: string;
  currency: "INR" | "USDT";
  type: string;
  referenceId?: string;
  description?: string;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  afterBalance: string;
  ledgerEntryId: string;
}> {
  const key = params.idempotencyKey ?? generateIdempotencyKey();

  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, params.userId))
      .for("update");

    if (!wallet) throw new Error("Wallet not found");
    if (wallet.isFrozen) throw new Error("Wallet is frozen");

    const beforeBalance =
      params.currency === "INR" ? wallet.inrBalance : wallet.usdtBalance;
    const amountNum = parseFloat(params.amount);
    const beforeNum = parseFloat(beforeBalance);
    const afterNum = beforeNum + amountNum;
    const afterBalance =
      params.currency === "INR" ? afterNum.toFixed(2) : afterNum.toFixed(8);

    if (params.currency === "INR") {
      await tx
        .update(walletsTable)
        .set({ inrBalance: afterBalance, updatedAt: new Date() })
        .where(eq(walletsTable.userId, params.userId));
    } else {
      await tx
        .update(walletsTable)
        .set({ usdtBalance: afterBalance, updatedAt: new Date() })
        .where(eq(walletsTable.userId, params.userId));
    }

    const [ledger] = await tx
      .insert(walletLedgerTable)
      .values({
        userId: params.userId,
        currency: params.currency,
        type: params.type,
        referenceId: params.referenceId,
        beforeBalance: beforeBalance,
        amount: params.amount,
        afterBalance: afterBalance,
        description: params.description,
        idempotencyKey: key,
      })
      .returning({ id: walletLedgerTable.id });

    logger.info(
      { userId: params.userId, amount: params.amount, type: params.type },
      "Wallet credited",
    );

    return { success: true, afterBalance, ledgerEntryId: ledger.id };
  });
}

export async function debitWallet(params: {
  userId: string;
  amount: string;
  currency: "INR" | "USDT";
  type: string;
  referenceId?: string;
  description?: string;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  afterBalance: string;
  ledgerEntryId: string;
}> {
  const key = params.idempotencyKey ?? generateIdempotencyKey();

  return await db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, params.userId))
      .for("update");

    if (!wallet) throw new Error("Wallet not found");
    if (wallet.isFrozen) throw new Error("Wallet is frozen");

    const beforeBalance =
      params.currency === "INR" ? wallet.inrBalance : wallet.usdtBalance;
    const amountNum = parseFloat(params.amount);
    const beforeNum = parseFloat(beforeBalance);

    if (beforeNum < amountNum) {
      throw new Error("Insufficient balance");
    }

    const afterNum = beforeNum - amountNum;
    const afterBalance =
      params.currency === "INR" ? afterNum.toFixed(2) : afterNum.toFixed(8);

    if (params.currency === "INR") {
      await tx
        .update(walletsTable)
        .set({ inrBalance: afterBalance, updatedAt: new Date() })
        .where(eq(walletsTable.userId, params.userId));
    } else {
      await tx
        .update(walletsTable)
        .set({ usdtBalance: afterBalance, updatedAt: new Date() })
        .where(eq(walletsTable.userId, params.userId));
    }

    const [ledger] = await tx
      .insert(walletLedgerTable)
      .values({
        userId: params.userId,
        currency: params.currency,
        type: params.type,
        referenceId: params.referenceId,
        beforeBalance: beforeBalance,
        amount: `-${params.amount}`,
        afterBalance: afterBalance,
        description: params.description,
        idempotencyKey: key,
      })
      .returning({ id: walletLedgerTable.id });

    logger.info(
      { userId: params.userId, amount: params.amount, type: params.type },
      "Wallet debited",
    );

    return { success: true, afterBalance, ledgerEntryId: ledger.id };
  });
}

export async function lockWallet(
  userId: string,
  reason: string,
  performedBy?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(walletsTable)
      .set({ isFrozen: true, updatedAt: new Date() })
      .where(eq(walletsTable.userId, userId));

    await tx.insert(walletLockLogsTable).values({
      userId,
      action: "lock",
      reason,
      performedBy,
    });
  });
}

export async function unlockWallet(
  userId: string,
  reason: string,
  performedBy?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(walletsTable)
      .set({ isFrozen: false, updatedAt: new Date() })
      .where(eq(walletsTable.userId, userId));

    await tx.insert(walletLockLogsTable).values({
      userId,
      action: "unlock",
      reason,
      performedBy,
    });
  });
}
