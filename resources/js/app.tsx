import { setNonce } from 'get-nonce';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from '@/router';

const cspNonce = document.querySelector<HTMLMetaElement>(
    'meta[name="csp-nonce"]',
)?.content;

if (cspNonce) {
    setNonce(cspNonce);
}

const container = document.getElementById('app');

if (container) {
    createRoot(container).render(
        <StrictMode>
            <RouterProvider router={router} />
        </StrictMode>,
    );
}
