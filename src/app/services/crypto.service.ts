import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { TenantService } from './tenant.service';

export type CryptoMoneda = 'USDT_TRC20' | 'BTC' | 'SOL';

export interface CryptoRates {
  bitcoin: { dop: number; usd: number };
  tether: { dop: number; usd: number };
  solana: { dop: number; usd: number };
}

export interface CryptoConfig {
  wallet_usdt_trc20: string | null;
  wallet_btc: string | null;
  wallet_solana: string | null;
}

@Injectable({ providedIn: 'root' })
export class CryptoService {
  private readonly COINGECKO_URL =
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether,solana&vs_currencies=dop,usd';

  private cachedRates: CryptoRates | null = null;
  private lastFetch = 0;
  private readonly CACHE_TTL_MS = 60_000; // 60 segundos

  constructor(
    private http: HttpClient,
    private supabase: SupabaseService,
    private tenantService: TenantService
  ) {}

  /**
   * Returns live rates with 60-second cache.
   */
  async getRates(): Promise<CryptoRates | null> {
    const now = Date.now();
    if (this.cachedRates && now - this.lastFetch < this.CACHE_TTL_MS) {
      return this.cachedRates;
    }
    try {
      const data = await firstValueFrom(
        this.http.get<CryptoRates>(this.COINGECKO_URL)
      );
      this.cachedRates = data;
      this.lastFetch = now;
      return data;
    } catch (e) {
      console.error('CoinGecko rate fetch failed:', e);
      return this.cachedRates; // return stale if request fails
    }
  }

  async getTasaUSDT_DOP(): Promise<number> {
    const rates = await this.getRates();
    return rates?.tether?.dop ?? 58.5; // fallback conservador
  }

  async getTasaBTC_DOP(): Promise<number> {
    const rates = await this.getRates();
    return rates?.bitcoin?.dop ?? 5_000_000; // fallback ~ $85k USD
  }

  async getTasaSOL_DOP(): Promise<number> {
    const rates = await this.getRates();
    return rates?.solana?.dop ?? 8500; // fallback ~ $145 USD
  }

  /**
   * Converts DOP amount to crypto equivalent for a given currency.
   */
  async convertirDOPaCrypto(montoDOP: number, moneda: CryptoMoneda): Promise<number> {
    if (moneda === 'USDT_TRC20') {
      const tasa = await this.getTasaUSDT_DOP();
      return parseFloat((montoDOP / tasa).toFixed(6));
    } else if (moneda === 'BTC') {
      const tasa = await this.getTasaBTC_DOP();
      return parseFloat((montoDOP / tasa).toFixed(8));
    } else {
      const tasa = await this.getTasaSOL_DOP();
      return parseFloat((montoDOP / tasa).toFixed(9)); // Solana has 9 decimals
    }
  }

  /**
   * Loads the crypto wallet config for this tenant's business.
   */
  async getCryptoConfig(): Promise<CryptoConfig> {
    try {
      const tenantId = this.tenantService.tenantId;
      if (!tenantId) return { wallet_usdt_trc20: null, wallet_btc: null, wallet_solana: null };

      const { data } = await this.supabase.client
        .from('tenants')
        .select('wallet_usdt_trc20, wallet_btc, wallet_solana')
        .eq('id', tenantId)
        .maybeSingle();

      return {
        wallet_usdt_trc20: data?.wallet_usdt_trc20 ?? null,
        wallet_btc: data?.wallet_btc ?? null,
        wallet_solana: data?.wallet_solana ?? null,
      };
    } catch {
      return { wallet_usdt_trc20: null, wallet_btc: null, wallet_solana: null };
    }
  }

  /**
   * Saves wallet addresses for this tenant.
   */
  async saveCryptoConfig(config: Partial<CryptoConfig>): Promise<void> {
    const tenantId = this.tenantService.tenantId;
    if (!tenantId) return;

    await this.supabase.client
      .from('tenants')
      .update(config)
      .eq('id', tenantId);
  }

  /**
   * Builds the URL for the QR image (uses qrserver.com – no library needed).
   */
  buildQrUrl(address: string, amount: number, moneda: CryptoMoneda): string {
    let payload = address;
    if (moneda === 'BTC') {
      payload = `bitcoin:${address}?amount=${amount}`;
    } else if (moneda === 'SOL') {
      payload = `solana:${address}?amount=${amount}`;
    } else {
      // For USDT TRC-20 we just show the address (Tron doesn't standardize URI)
      payload = address;
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(payload)}`;
  }

  decimalPlacesFor(moneda: CryptoMoneda): number {
    if (moneda === 'BTC') return 8;
    if (moneda === 'SOL') return 9;
    return 6;
  }

  labelFor(moneda: CryptoMoneda): string {
    if (moneda === 'USDT_TRC20') return 'USDT (TRC-20)';
    if (moneda === 'BTC') return 'Bitcoin (BTC)';
    return 'Solana (SOL)';
  }

  symbolFor(moneda: CryptoMoneda): string {
    if (moneda === 'USDT_TRC20') return 'USDT';
    if (moneda === 'BTC') return 'BTC';
    return 'SOL';
  }
}
