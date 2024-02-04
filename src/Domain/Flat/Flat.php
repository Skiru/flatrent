<?php

declare(strict_types=1);

namespace App\Domain\Flat;

use App\Domain\User\UserId;

final readonly class Flat
{
    public function __construct(public FlatId $flatId, public UserId $ownerId)
    {
    }

    public function isOwner(UserId $userId): bool
    {
        return $this->ownerId->equals($userId);
    }
}
