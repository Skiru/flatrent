<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain;

use App\Shared\Domain\DataStructures\Vector;

final readonly class PropertyFactory
{
    public function create(PropertyId $propertyId): Property
    {
        return new Property($propertyId, Vector::empty());
    }
}
