<?php

declare(strict_types=1);

namespace App\Domain\Flat;

use App\Domain\User\UserId;

final readonly class FlatFactory
{
    public function create(FlatId $flatId, UserId $ownerId): Flat
    {
        return new Flat($flatId, $ownerId);
    }
}
