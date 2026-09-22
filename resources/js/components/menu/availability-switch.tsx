import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { setMenuItemAvailability } from '@/lib/menu';
import { cn } from '@/lib/utils';
import type { MenuItem } from '@/types';

type AvailabilitySwitchProps = {
    item: MenuItem;
    onChanged: () => void;
};

export function AvailabilitySwitch({
    item,
    onChanged,
}: AvailabilitySwitchProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const id = `available-${item.id}`;

    async function handleChange(checked: boolean) {
        setIsSaving(true);
        setError(null);

        try {
            await setMenuItemAvailability(item.id, checked);
            onChanged();
        } catch {
            setError('Not saved. Try again.');
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Switch
                id={id}
                checked={item.is_available}
                disabled={isSaving}
                onCheckedChange={(checked) => void handleChange(checked)}
            />
            <Label
                htmlFor={id}
                className={cn(
                    'w-16 text-sm',
                    !item.is_available && 'font-semibold text-achuete',
                )}
            >
                {item.is_available ? 'Available' : 'Ubos na'}
            </Label>
            {error && (
                <span role="alert" className="text-xs text-destructive">
                    {error}
                </span>
            )}
        </div>
    );
}
