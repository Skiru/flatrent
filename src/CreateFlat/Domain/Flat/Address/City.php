<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat\Address;

final readonly class City
{
    public function __construct(public string $city)
    {
    }
}
