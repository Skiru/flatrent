<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat;

interface FlatRepositoryInterface
{
    public function save(Flat $flat): void;
}
