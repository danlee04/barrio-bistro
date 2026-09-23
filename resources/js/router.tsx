import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import PublicLayout from '@/layouts/public-layout';
import { authLoader, guestLoader, staffLoader } from '@/lib/auth';
import {
    archivedItemsLoader,
    categoriesLoader,
    menuBoardLoader,
    menuItemFormLoader,
} from '@/lib/menu';
import { kitchenLoader, queueLoader } from '@/lib/ops';
import { orderLoader } from '@/lib/orders';
import { checkoutOptionsLoader } from '@/lib/payments';
import { publicMenuLoader } from '@/lib/public-menu';
import { staffPageLoader } from '@/lib/staff';
import Cart from '@/pages/cart';
import Home from '@/pages/home';
import Menu from '@/pages/menu';
import NotFound from '@/pages/not-found';
import OrderStatus from '@/pages/order-status';
import RouteError from '@/pages/route-error';

/**
 * Load a page only when its route is visited, so customers never download
 * the staff screens.
 */
function page(load: () => Promise<{ default: ComponentType }>) {
    return async () => ({ Component: (await load()).default });
}

export const router = createBrowserRouter([
    {
        id: 'public',
        element: <PublicLayout />,
        errorElement: <RouteError />,
        loader: publicMenuLoader,
        children: [
            { path: '/', element: <Home /> },
            { path: '/menu', element: <Menu /> },
            { path: '/cart', element: <Cart />, loader: checkoutOptionsLoader },
            {
                path: '/order/:token',
                loader: orderLoader,
                element: <OrderStatus />,
                errorElement: <RouteError />,
            },
            { path: '*', element: <NotFound /> },
        ],
    },
    {
        path: '/login',
        loader: guestLoader,
        lazy: page(() => import('@/pages/auth/login')),
    },
    {
        path: '/account/password',
        loader: authLoader,
        lazy: page(() => import('@/pages/account/change-password')),
        errorElement: <RouteError />,
    },
    {
        id: 'admin',
        path: '/admin',
        loader: staffLoader,
        lazy: page(() => import('@/layouts/admin-layout')),
        errorElement: <RouteError />,
        children: [
            {
                index: true,
                lazy: page(() => import('@/pages/admin/dashboard')),
            },
            {
                path: 'orders',
                loader: queueLoader,
                lazy: page(() => import('@/pages/admin/orders')),
                errorElement: <RouteError />,
            },
            {
                path: 'kitchen',
                loader: kitchenLoader,
                lazy: page(() => import('@/pages/admin/kitchen')),
                errorElement: <RouteError />,
            },
            {
                path: 'menu',
                loader: menuBoardLoader,
                lazy: page(() => import('@/pages/admin/menu/index')),
                errorElement: <RouteError />,
            },
            {
                path: 'menu/items/new',
                loader: menuItemFormLoader,
                lazy: page(() => import('@/pages/admin/menu/item-form')),
                errorElement: <RouteError />,
            },
            {
                path: 'menu/items/:itemId/edit',
                loader: menuItemFormLoader,
                lazy: page(() => import('@/pages/admin/menu/item-form')),
                errorElement: <RouteError />,
            },
            {
                path: 'menu/categories',
                loader: categoriesLoader,
                lazy: page(() => import('@/pages/admin/menu/categories')),
                errorElement: <RouteError />,
            },
            {
                path: 'menu/archived',
                loader: archivedItemsLoader,
                lazy: page(() => import('@/pages/admin/menu/archived')),
                errorElement: <RouteError />,
            },
            {
                path: 'staff',
                loader: staffPageLoader,
                lazy: page(() => import('@/pages/admin/staff')),
                errorElement: <RouteError />,
            },
        ],
    },
]);
