import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_QUANTITY } from '@/lib/cart';

type QuantityStepperProps = {
    value: number;
    label: string;
    onChange: (value: number) => void;
};

export function QuantityStepper({
    value,
    label,
    onChange,
}: QuantityStepperProps) {
    return (
        <div className="flex items-center gap-1">
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 rounded-full"
                aria-label={`One less ${label}`}
                onClick={() => onChange(value - 1)}
            >
                <Minus aria-hidden="true" />
            </Button>

            <output
                className="w-10 text-center font-display text-lg font-extrabold"
                aria-label={`${value} ${label}`}
            >
                {value}
            </output>

            <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 rounded-full"
                aria-label={`One more ${label}`}
                disabled={value >= MAX_QUANTITY}
                onClick={() => onChange(value + 1)}
            >
                <Plus aria-hidden="true" />
            </Button>
        </div>
    );
}
