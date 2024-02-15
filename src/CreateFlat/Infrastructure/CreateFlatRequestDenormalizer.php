<?php

declare(strict_types=1);

namespace App\CreateFlat\Infrastructure;

use App\CreateFlat\Application\CreateFlatRequest;
use App\CreateFlat\Application\CreateRoomRequest;
use App\Shared\Infrastructure\Exception\HttpRequestValidationException;
use Ds\Map;
use Ds\Vector;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Validator\Constraints\Collection;
use Symfony\Component\Validator\Validator\ValidatorInterface;

final readonly class CreateFlatRequestDenormalizer implements DenormalizerInterface
{
    public function __construct(private ValidatorInterface $validator)
    {
    }

    public function denormalize(
        mixed $data,
        string $type,
        ?string $format = null,
        array $context = [],
    ): CreateFlatRequest {
        if (false === is_array($data)) {
            throw new \InvalidArgumentException('CreateFlatRequest denormalization data should be passed as array');
        }

        $mapData = new Map($data);

        $constraint = new Collection([]);

        $validationResult = $this->validator->validate($constraint);

        if (count($validationResult > 0)) {
            throw HttpRequestValidationException::fromError($validationResult);
        }

        $rooms = (new Vector($mapData->get('rooms')))
            ->map(
                static fn(array $room): CreateRoomRequest => new CreateRoomRequest($room['roomName'], $room['roomType'])
            );

        return new CreateFlatRequest(
            $mapData->get('ownerId'),
            $mapData->get('address'),
            $mapData->get('zipCode'),
            $rooms,
        );
    }

    public function supportsDenormalization(
        mixed $data,
        string $type,
        ?string $format = null,
        array $context = [],
    ): bool {
        return $type === CreateFlatRequest::class;
    }

    public function getSupportedTypes(?string $format): array
    {
        return [CreateFlatRequest::class];
    }
}
