<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat\Address;

final readonly class Address
{
    public function __construct(
        public City $city,
        public Street $street,
        public ZipCode $zipCode,
        public FlatNumber $flatNumber,
        public DoorNumber $doorNumber,
    ) {
    }
}
