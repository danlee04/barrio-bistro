import { createBrowserRouter } from 'react-router';
import AdminLayout from '@/layouts/admin-layout';
import { authLoader, guestLoader, staffLoader } from '@/lib/auth';
import {
    archivedItemsLoader,
    categoriesLoader,
    menuBoardLoader,
    menuItemFormLoader,
} from '@/lib/menu';
import { staffPageLoader } from '@/lib/staff';
import ChangePassword from '@/pages/account/change-password';
import Dashboard from '@/pages/admin/dashboard';
import ArchivedItems from '@/pages/admin/menu/archived';
import Categories from '@/pages/admin/menu/categories';
import MenuBoard from '@/pages/admin/menu/index';
import MenuItemFormPage from '@/pages/admin/menu/item-form';
import Staff from '@/pages/admin/staff';
import Login from '@/pages/auth/login';
import Home from '@/pages/home';
import NotFound from '@/pages/not-found';
import RouteError from '@/pages/route-error';

export const router = createBrowserRouter([
    { path: '/', element: <Home /> },
    { path: '/login', element: <Login />, loader: guestLoader },
    {
        path: '/account/password',
        element: <ChangePassword />,
        loader: authLoader,
        errorElement: <RouteError />,
    },
    {
        id: 'admin',
        path: '/admin',
        element: <AdminLayout />,
        loader: staffLoader,
        errorElement: <RouteError />,
        children: [
            { index: true, element: <Dashboard /> },
            {
                path: 'menu',
                element: <MenuBoard />,
                loader: menuBoardLoader,
                errorElement: <RouteError />,
            },
            {
                path: 'menu/items/new',
                element: <MenuItemFormPage />,
                loader: menuItemFormLoader,
                errorElement: <RouteError />,
            },
            {
                path: 'menu/items/:itemId/edit',
                element: <MenuItemFormPage />,
                loader: menuItemFormLoader,
                errorElement: <RouteError />,
            },
            {
                path: 'menu/categories',
                element: <Categories />,
                loader: categoriesLoader,
                errorElement: <RouteError />,
            },
            {
                path: 'menu/archived',
                element: <ArchivedItems />,
                loader: archivedItemsLoader,
                errorElement: <RouteError />,
            },
            {
                path: 'staff',
                element: <Staff />,
                loader: staffPageLoader,
                errorElement: <RouteError />,
            },
        ],
    },
    { path: '*', element: <NotFound /> },
]);
