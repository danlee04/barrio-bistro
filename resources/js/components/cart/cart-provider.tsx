import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
    addLine,
    type Cart,
    cartCount,
    clearCart,
    emptyCart,
    readCart,
    removeLine,
    setNote as setLineNote,
    setQuantity as setLineQuantity,
    setTable as setCartTable,
    writeCart,
} from '@/lib/cart';
import { CartContext, type CartContextValue } from '@/lib/cart-context';

export function CartProvider({ children }: { children: ReactNode }) {
    const [cart, setCart] = useState<Cart>(() => readCart());
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        writeCart(cart);
    }, [cart]);

    // A table QR arrives as ?table=7: remember it, then tidy the address bar.
    useEffect(() => {
        const raw = searchParams.get('table');

        if (raw === null) {
            return;
        }

        setCart((current) => setCartTable(current, Number.parseInt(raw, 10)));

        const next = new URLSearchParams(searchParams);
        next.delete('table');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const value = useMemo<CartContextValue>(
        () => ({
            cart,
            count: cartCount(cart),
            add: (itemId, sizeId) =>
                setCart((current) => addLine(current, itemId, sizeId)),
            setQuantity: (sizeId, quantity) =>
                setCart((current) =>
                    setLineQuantity(current, sizeId, quantity),
                ),
            setNote: (sizeId, note) =>
                setCart((current) => setLineNote(current, sizeId, note)),
            remove: (sizeId) =>
                setCart((current) => removeLine(current, sizeId)),
            setTable: (table) =>
                setCart((current) => setCartTable(current, table)),
            clear: () => {
                clearCart();
                setCart(emptyCart);
            },
        }),
        [cart],
    );

    return <CartContext value={value}>{children}</CartContext>;
}
