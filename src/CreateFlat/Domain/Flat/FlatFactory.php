<?php

declare(strict_types=1);

namespace App\CreateFlat\Domain\Flat;

use App\CreateFlat\Domain\User\UserId;

final readonly class FlatFactory
{
    public function create(FlatId $flatId, UserId $ownerId): Flat
    {
        return new Flat($flatId, $ownerId);
    }
}
