<?php

declare(strict_types=1);

namespace App\CreateFlat\Application\CreateFlat;

use App\CreateFlat\Domain\Flat\FlatId;
use App\CreateFlat\Domain\User\UserId;
use App\Shared\SyncMessageInterface;

final readonly class CreateFlatCommand implements SyncMessageInterface
{
    public function __construct(public FlatId $flatId, public UserId $ownerId)
    {
    }
}
