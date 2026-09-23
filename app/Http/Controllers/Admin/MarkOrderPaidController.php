<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\User;
use App\Services\PaymentConfirmer;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;

class MarkOrderPaidController extends Controller
{
    /**
     * Record a counter payment. The screen for this arrives with the cashier
     * queue in Module 6.
     */
    public function __invoke(Order $order, #[CurrentUser] User $user, PaymentConfirmer $confirmer): OrderResource
    {
        Gate::authorize('markPaid', $order);

        $confirmer->confirmAtCounter($order, $user);

        return OrderResource::make($order->refresh()->load('items'));
    }
}
