import { useState, type FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { restaurant } from '@/content/restaurant';
import { HttpError, type ValidationErrors } from '@/lib/http';
import { sendInquiry } from '@/lib/inquiries';
import { zonedDate } from '@/lib/restaurant-time';
import type { InquiryType } from '@/types';

const MAX_MESSAGE = 2000;

type InquiryFormProps = {
    type: InquiryType;
    heading: string;
    description: string;
    messageLabel: string;
    messagePlaceholder: string;
};

/**
 * The one form behind both the bulk-order page and the contact page. A bulk
 * order also asks for the day and the headcount; an ordinary message does not.
 */
export function InquiryForm({
    type,
    heading,
    description,
    messageLabel,
    messagePlaceholder,
}: InquiryFormProps) {
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [guests, setGuests] = useState('');
    const [message, setMessage] = useState('');
    const [website, setWebsite] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);

    const isBulk = type === 'bulk';
    const today = zonedDate(new Date(), restaurant.timeZone);
    const fieldError = (key: string): string | undefined => errors[key]?.[0];

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrors({});
        setFormError(null);
        setIsSending(true);

        try {
            await sendInquiry({
                type,
                name,
                contact,
                event_date: isBulk && eventDate !== '' ? eventDate : null,
                guests: isBulk && guests !== '' ? Number(guests) : null,
                message,
                website,
            });

            setIsSent(true);
        } catch (caught) {
            if (caught instanceof HttpError && caught.status === 422) {
                setErrors(caught.errors);
                setFormError('Check the fields marked below.');
            } else if (caught instanceof HttpError && caught.status === 429) {
                setFormError(
                    `That is a few messages in a row. Give it a few minutes, or ring ${restaurant.phone.display}.`,
                );
            } else {
                setFormError('Could not reach the shop. Try again.');
            }
        } finally {
            setIsSending(false);
        }
    }

    if (isSent) {
        return (
            <div
                role="status"
                className="flex flex-col items-start gap-3 rounded-xl border border-dahon/30 bg-dahon/10 p-6"
            >
                <h2 className="font-display text-2xl font-bold">
                    Thanks, we have it.
                </h2>
                <p className="text-lg">
                    Someone from the shop will get back to you. If it is urgent,
                    ring{' '}
                    <a
                        href={`tel:${restaurant.phone.tel}`}
                        className="underline underline-offset-4"
                    >
                        {restaurant.phone.display}
                    </a>
                    .
                </p>
                <Button
                    variant="outline"
                    className="min-h-11 rounded-full px-5"
                    onClick={() => {
                        setName('');
                        setContact('');
                        setEventDate('');
                        setGuests('');
                        setMessage('');
                        setIsSent(false);
                    }}
                >
                    Send another
                </Button>
            </div>
        );
    }

    return (
        <form
            noValidate
            onSubmit={(event) => void handleSubmit(event)}
            className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6"
        >
            <div className="flex flex-col gap-1">
                <h2 className="font-display text-2xl font-bold">{heading}</h2>
                <p className="text-muted-foreground">{description}</p>
            </div>

            {formError && (
                <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                    id="inquiry-name"
                    label="Your name"
                    value={name}
                    maxLength={80}
                    autoComplete="name"
                    error={fieldError('name')}
                    onChange={(event) => setName(event.target.value)}
                />
                <FormField
                    id="inquiry-contact"
                    label="Email or mobile"
                    value={contact}
                    maxLength={120}
                    autoComplete="email"
                    placeholder="you@example.com or 0917…"
                    error={fieldError('contact')}
                    onChange={(event) => setContact(event.target.value)}
                />

                {isBulk && (
                    <>
                        <FormField
                            id="inquiry-date"
                            label="Which day"
                            type="date"
                            value={eventDate}
                            min={today}
                            error={fieldError('event_date')}
                            onChange={(event) =>
                                setEventDate(event.target.value)
                            }
                        />
                        <FormField
                            id="inquiry-guests"
                            label="How many people"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={1000}
                            value={guests}
                            error={fieldError('guests')}
                            onChange={(event) => setGuests(event.target.value)}
                        />
                    </>
                )}
            </div>

            <div className="grid gap-2">
                <Label htmlFor="inquiry-message">{messageLabel}</Label>
                <Textarea
                    id="inquiry-message"
                    rows={5}
                    value={message}
                    maxLength={MAX_MESSAGE}
                    placeholder={messagePlaceholder}
                    aria-invalid={fieldError('message') ? true : undefined}
                    aria-describedby={
                        fieldError('message')
                            ? 'inquiry-message-error'
                            : undefined
                    }
                    onChange={(event) => setMessage(event.target.value)}
                />
                {fieldError('message') && (
                    <p
                        id="inquiry-message-error"
                        className="text-sm text-destructive"
                    >
                        {fieldError('message')}
                    </p>
                )}
            </div>

            {/* The honeypot: off-screen and skipped by keyboard, so only a robot fills it. */}
            <div aria-hidden="true" className="absolute left-[-9999px]">
                <label htmlFor="inquiry-website">Leave this empty</label>
                <input
                    id="inquiry-website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                />
            </div>

            <div>
                <Button
                    type="submit"
                    size="lg"
                    disabled={isSending}
                    className="min-h-12 rounded-full px-6 text-base"
                >
                    {isSending ? 'Sending…' : 'Send'}
                </Button>
            </div>
        </form>
    );
}
