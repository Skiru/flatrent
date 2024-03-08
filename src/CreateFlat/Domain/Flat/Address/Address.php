<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat\Address;

use App\CreateFlat\Domain\Flat\Address\Building\Building;

final readonly class Address
{
    public function __construct(
        public City $city,
        public Street $street,
        public ZipCode $zipCode,
        public Building $building,
    ) {
    }
}
