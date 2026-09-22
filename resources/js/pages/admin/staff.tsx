import { useState, type FormEvent } from 'react';
import {
    useLoaderData,
    useRevalidator,
    useRouteLoaderData,
    useSearchParams,
} from 'react-router';
import { ResetPasswordDialog } from '@/components/staff/reset-password-dialog';
import { StaffFormDialog } from '@/components/staff/staff-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { staffLoader } from '@/lib/auth';
import type { staffPageLoader } from '@/lib/staff';
import type { StaffUser } from '@/types';

const lastLoginFormat = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export default function Staff() {
    const { data: staff, meta } = useLoaderData<typeof staffPageLoader>();
    const current = useRouteLoaderData<typeof staffLoader>('admin');
    const revalidator = useRevalidator();
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState(searchParams.get('search') ?? '');
    const [isCreating, setIsCreating] = useState(false);
    const [editing, setEditing] = useState<StaffUser | null>(null);
    const [resetting, setResetting] = useState<StaffUser | null>(null);

    const refresh = () => void revalidator.revalidate();

    function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSearchParams(search ? { search } : {});
    }

    function goToPage(page: number) {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(page));
        setSearchParams(next);
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl font-extrabold">
                        Staff
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {meta.total} accounts
                    </p>
                </div>
                <Button onClick={() => setIsCreating(true)}>Add staff</Button>
            </div>

            <form
                onSubmit={handleSearch}
                className="flex max-w-md gap-2"
                role="search"
            >
                <Input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name or email"
                    aria-label="Search staff"
                    maxLength={100}
                />
                <Button type="submit" variant="outline">
                    Search
                </Button>
            </form>

            <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last login</TableHead>
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {staff.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="py-8 text-center text-muted-foreground"
                                >
                                    No staff found.
                                </TableCell>
                            </TableRow>
                        )}
                        {staff.map((member) => (
                            <TableRow key={member.id}>
                                <TableCell className="font-medium">
                                    {member.name}
                                </TableCell>
                                <TableCell>{member.email}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary">
                                        {member.role_label}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {member.is_active ? (
                                        <Badge className="bg-kalamansi text-uling">
                                            Active
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline">
                                            Deactivated
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {member.last_login_at
                                        ? lastLoginFormat.format(
                                              new Date(member.last_login_at),
                                          )
                                        : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setEditing(member)}
                                        >
                                            Edit
                                        </Button>
                                        {member.id !== current?.user.id && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    setResetting(member)
                                                }
                                            >
                                                Reset password
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {meta.last_page > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={meta.current_page <= 1}
                        onClick={() => goToPage(meta.current_page - 1)}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {meta.current_page} of {meta.last_page}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={meta.current_page >= meta.last_page}
                        onClick={() => goToPage(meta.current_page + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}

            {isCreating && (
                <StaffFormDialog
                    staff={null}
                    isSelf={false}
                    onClose={() => setIsCreating(false)}
                    onSaved={refresh}
                />
            )}
            {editing && (
                <StaffFormDialog
                    key={editing.id}
                    staff={editing}
                    isSelf={editing.id === current?.user.id}
                    onClose={() => setEditing(null)}
                    onSaved={refresh}
                />
            )}
            {resetting && (
                <ResetPasswordDialog
                    key={resetting.id}
                    staff={resetting}
                    onClose={() => setResetting(null)}
                />
            )}
        </div>
    );
}
