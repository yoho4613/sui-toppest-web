/**
 * Shop Products API Route
 * GET: Fetch all active products (optionally by category)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getShopProducts } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;

    const products = await getShopProducts(category);

    // Calculate SUI price from USD for each product
    const suiUsdPrice = parseFloat(process.env.SUI_USD_PRICE || '1.5');
    const productsWithSuiPrice = products.map((product) => ({
      ...product,
      price_sui: product.price_usd / suiUsdPrice,
      price_sui_mist: Math.ceil((product.price_usd / suiUsdPrice) * 1e9).toString(),
    }));

    return NextResponse.json({
      success: true,
      products: productsWithSuiPrice,
    });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
