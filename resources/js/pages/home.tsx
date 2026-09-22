import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function Home() {
    return (
        <main className="min-h-screen bg-dahon p-6 text-pandan">
            <div className="mx-auto flex max-w-4xl flex-col gap-6 py-24">
                <Badge className="bg-kalamansi text-uling">Bukas ngayon</Badge>
                <h1 className="font-display text-5xl leading-tight font-extrabold md:text-7xl">
                    Nasa kalan
                    <br />
                    ngayong hapon.
                </h1>
                <Button size="lg" className="w-fit">
                    Tingnan ang menu
                </Button>
            </div>
        </main>
    );
}
