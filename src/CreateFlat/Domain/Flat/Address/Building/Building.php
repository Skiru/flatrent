<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat\Address\Building;

final readonly class Building
{
    public function __construct(
        public BuildingNumber $buildingNumber,
        public DoorNumber $doorNumber,
        public FlatNumber $flatNumber,
    ) {
    }
}
