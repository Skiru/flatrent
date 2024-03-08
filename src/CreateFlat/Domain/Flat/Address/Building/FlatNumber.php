<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat\Address\Building;

final readonly class FlatNumber
{
    public function __construct(public int $number)
    {
    }
}
