<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

trait HasSortOrder
{
    /**
     * The query for the records this one is ordered among.
     *
     * @return Builder<static>
     */
    abstract protected function sortSiblings(): Builder;

    /**
     * The next free position at the end of this record's siblings.
     */
    public function nextSortOrder(): int
    {
        $highest = $this->sortSiblings()->max('sort_order');

        return is_numeric($highest) ? (int) $highest + 1 : 0;
    }

    /**
     * Swap this record with its neighbour ('up' or 'down') and renumber the siblings 0..n.
     */
    public function moveInSortOrder(string $direction): void
    {
        DB::transaction(function () use ($direction): void {
            $siblings = $this->sortSiblings()
                ->orderBy('sort_order')
                ->orderBy($this->getKeyName())
                ->lockForUpdate()
                ->get()
                ->values()
                ->all();

            $index = null;

            foreach ($siblings as $position => $sibling) {
                if ($sibling->is($this)) {
                    $index = $position;
                }
            }

            if ($index === null) {
                return;
            }

            $target = $direction === 'up' ? $index - 1 : $index + 1;

            if (! isset($siblings[$target])) {
                return;
            }

            [$siblings[$index], $siblings[$target]] = [$siblings[$target], $siblings[$index]];

            foreach ($siblings as $position => $sibling) {
                if ($sibling->getAttribute('sort_order') !== $position) {
                    $sibling->setAttribute('sort_order', $position);
                    $sibling->save();
                }
            }
        });
    }
}
