/**
 * Shop Database Functions
 */

import { supabaseAdmin } from '@/lib/supabase';

// Types
export interface ShopProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_usd: number;
  price_sui_mist: string | null;
  price_luck: number;
  reward_type: string;
  reward_amount: number;
  sort_order: number;
  badge: string | null;
  bonus_text: string | null;
  is_active: boolean;
}

export interface Purchase {
  id: string;
  user_id: string;
  wallet_address: string;
  product_id: string;
  product_name: string;
  reward_type: string;
  reward_amount: number;
  payment_method: 'sui' | 'luck';
  amount_paid: string;
  price_usd: number | null;
  transaction_digest: string | null;
  sender_address: string | null;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  created_at: string;
  verified_at: string | null;
}

export interface CreatePurchaseInput {
  wallet_address: string;
  product_id: string;
  payment_method: 'sui' | 'luck';
  amount_paid: string;
  price_usd?: number;
}

// Get all active products
export async function getShopProducts(category?: string): Promise<ShopProduct[]> {
  if (!supabaseAdmin) {
    console.error('Supabase admin not configured');
    return [];
  }

  let query = supabaseAdmin
    .from('shop_products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch products:', error);
    return [];
  }

  return data || [];
}

// Get single product by ID
export async function getProductById(productId: string): Promise<ShopProduct | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('shop_products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error) {
    console.error('Failed to fetch product:', error);
    return null;
  }

  return data;
}

// Create a pending purchase record
export async function createPurchase(input: CreatePurchaseInput): Promise<{
  success: boolean;
  purchase?: Purchase;
  error?: string;
}> {
  if (!supabaseAdmin) {
    return { success: false, error: 'Database not configured' };
  }

  // Get user ID from wallet address
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('wallet_address', input.wallet_address)
    .single();

  if (!profile) {
    return { success: false, error: 'User not found' };
  }

  // Get product details
  const product = await getProductById(input.product_id);
  if (!product) {
    return { success: false, error: 'Product not found' };
  }

  // Create purchase record
  const { data, error } = await supabaseAdmin
    .from('purchases')
    .insert({
      user_id: profile.id,
      wallet_address: input.wallet_address,
      product_id: input.product_id,
      product_name: product.name,
      reward_type: product.reward_type,
      reward_amount: product.reward_amount,
      payment_method: input.payment_method,
      amount_paid: input.amount_paid,
      price_usd: input.price_usd || product.price_usd,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create purchase:', error);
    return { success: false, error: 'Failed to create purchase record' };
  }

  return { success: true, purchase: data };
}

// Complete a purchase (verify payment and grant reward)
export async function completePurchase(
  purchaseId: string,
  transactionDigest: string,
  senderAddress: string
): Promise<{
  success: boolean;
  rewardType?: string;
  rewardAmount?: number;
  error?: string;
}> {
  if (!supabaseAdmin) {
    return { success: false, error: 'Database not configured' };
  }

  // Use the database function for atomic operation
  const { data, error } = await supabaseAdmin.rpc('complete_purchase', {
    p_purchase_id: purchaseId,
    p_digest: transactionDigest,
    p_sender: senderAddress,
  });

  if (error) {
    console.error('Failed to complete purchase:', error);
    return { success: false, error: 'Failed to complete purchase' };
  }

  if (!data || data.length === 0 || !data[0].success) {
    return { success: false, error: 'Purchase not found or already completed' };
  }

  return {
    success: true,
    rewardType: data[0].reward_type,
    rewardAmount: data[0].reward_amount,
  };
}

// Get purchase by ID
export async function getPurchaseById(purchaseId: string): Promise<Purchase | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('purchases')
    .select('*')
    .eq('id', purchaseId)
    .single();

  if (error) {
    console.error('Failed to fetch purchase:', error);
    return null;
  }

  return data;
}

// Get pending purchase for idempotency check
export async function getPendingPurchase(
  walletAddress: string,
  productId: string
): Promise<Purchase | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data } = await supabaseAdmin
    .from('purchases')
    .select('*')
    .eq('wallet_address', walletAddress)
    .eq('product_id', productId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data || null;
}

// Get user's purchase history
export async function getUserPurchases(
  walletAddress: string,
  limit: number = 20
): Promise<Purchase[]> {
  if (!supabaseAdmin) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('purchases')
    .select('*')
    .eq('wallet_address', walletAddress)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch user purchases:', error);
    return [];
  }

  return data || [];
}

// Mark purchase as failed
export async function failPurchase(purchaseId: string, error?: string): Promise<boolean> {
  if (!supabaseAdmin) {
    return false;
  }

  const { error: updateError } = await supabaseAdmin
    .from('purchases')
    .update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', purchaseId);

  if (updateError) {
    console.error('Failed to mark purchase as failed:', updateError);
    return false;
  }

  return true;
}

// Get user's star tickets
export async function getUserStarTickets(walletAddress: string): Promise<number> {
  if (!supabaseAdmin) {
    return 0;
  }

  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('star_tickets')
    .eq('wallet_address', walletAddress)
    .single();

  return data?.star_tickets || 0;
}
