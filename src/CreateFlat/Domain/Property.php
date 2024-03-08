<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain;

use App\CreateFlat\Domain\Flat\Flat;
use App\Shared\Domain\DataStructures\Vector;

final readonly class Property
{
    /**
     * @param Vector<Flat> $flats
     */
    public function __construct(public PropertyId $propertyId, public Vector $flats)
    {
    }

    public function takePossession(Flat $flat): void
    {

    }
}
