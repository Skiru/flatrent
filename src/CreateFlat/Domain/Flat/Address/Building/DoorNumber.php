<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat\Address\Building;

final readonly class DoorNumber
{
    public function __construct(public int $number)
    {
    }
}
